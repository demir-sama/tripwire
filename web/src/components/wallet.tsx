"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { WalletSelector, ModuleState } from "@near-wallet-selector/core";
import { NETWORK } from "@/lib/config";
import { parseTrip } from "@/lib/rules";

export type TxResult =
  | { ok: true; hash: string | null; value?: unknown }
  | { ok: false; hash: string | null; rule: string | null; message: string; cancelled?: boolean };

type Ctx = {
  ready: boolean;
  accountId: string | null;
  modules: ModuleState[];
  open: boolean;
  setOpen: (v: boolean) => void;
  connect: (moduleId: string) => Promise<void>;
  disconnect: () => Promise<void>;
  call: (receiverId: string, methodName: string, args: Record<string, unknown>, depositYocto?: string, gas?: string) => Promise<TxResult>;
};
const WalletCtx = createContext<Ctx | null>(null);

function decodeValue(b64?: string) {
  if (!b64) return undefined;
  try { return JSON.parse(atob(b64)); } catch { return undefined; }
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const sel = useRef<WalletSelector | null>(null);
  const [ready, setReady] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [modules, setModules] = useState<ModuleState[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let sub: { unsubscribe(): void } | undefined;
    (async () => {
      const [{ setupWalletSelector }, { setupMeteorWallet }, { setupIntearWallet }, { setupHotWallet }, { setupSender }] = await Promise.all([
        import("@near-wallet-selector/core"),
        import("@near-wallet-selector/meteor-wallet"),
        import("@near-wallet-selector/intear-wallet"),
        import("@near-wallet-selector/hot-wallet"),
        import("@near-wallet-selector/sender"),
      ]);
      const s = await setupWalletSelector({
        network: NETWORK,
        modules: [setupIntearWallet(), setupMeteorWallet(), setupHotWallet(), setupSender()],
      });
      sel.current = s;
      const st = s.store.getState();
      setModules(st.modules);
      setAccountId(st.accounts.find((a) => a.active)?.accountId ?? st.accounts[0]?.accountId ?? null);
      sub = s.store.observable.subscribe((state) => {
        setModules(state.modules);
        setAccountId(state.accounts.find((a) => a.active)?.accountId ?? state.accounts[0]?.accountId ?? null);
      });
      setReady(true);
    })().catch((e) => { console.error("wallet selector", e); setReady(true); });
    return () => sub?.unsubscribe();
  }, []);

  const connect = useCallback(async (moduleId: string) => {
    const w = await sel.current!.wallet(moduleId);
    setOpen(false); // wallets like Intear render their own overlay; get ours out of the way
    await w.signIn({ contractId: undefined as unknown as string, methodNames: [] } as never);
    setOpen(false);
  }, []);

  const disconnect = useCallback(async () => {
    try { const w = await sel.current!.wallet(); await w.signOut(); } catch {}
    setAccountId(null);
  }, []);

  const call = useCallback<Ctx["call"]>(async (receiverId, methodName, args, depositYocto = "0", gas = "100000000000000") => {
    if (!sel.current || !accountId) return { ok: false, hash: null, rule: null, message: "Connect a wallet first" };
    const started = Date.now();
    const { actionCreators } = await import("@near-js/transactions");
    const w = await sel.current.wallet();
    try {
      const out: any = await w.signAndSendTransaction({ receiverId, actions: [actionCreators.functionCall(methodName, args, BigInt(gas), BigInt(depositYocto))] });
      const hash = out?.transaction?.hash ?? out?.transaction_outcome?.id ?? null;
      const failure = out?.status?.Failure ?? out?.receipts_outcome?.find((r: any) => r.outcome?.status?.Failure)?.outcome?.status?.Failure;
      if (failure) {
        const p = parseTrip(JSON.stringify(failure));
        return { ok: false, hash, rule: p?.rule ?? null, message: p?.message ?? "Transaction failed" };
      }
      return { ok: true, hash, value: decodeValue(out?.status?.SuccessValue) };
    } catch (e: any) {
      const text = `${e?.message ?? ""} ${JSON.stringify(e ?? {})}`;
      if (/closed the window|reject|cancel|denied/i.test(text) && !/TRIPWIRE\[/.test(text)) return { ok: false, hash: null, rule: null, message: "You cancelled in the wallet.", cancelled: true };
      let p = parseTrip(text);
      let hash: string | null = text.match(/([1-9A-HJ-NP-Za-km-z]{43,44})/)?.[1] ?? null;
      // Wallets often hide the hash of a failed tx; find it on-chain.
      for (let i = 0; i < 20 && (!hash || !p); i++) {
        await new Promise((r) => setTimeout(r, 1500));
        try {
          const r = await fetch(`/api/trips?account=${receiverId}&signer=${accountId}&since=${started}`).then((x) => x.json());
          const l = r.latest;
          if (l?.hash) { hash = l.hash; if (l.rule) p = { rule: l.rule, message: l.message }; break; }
        } catch {}
      }
      return { ok: false, hash, rule: p?.rule ?? null, message: p?.message ?? (e?.message || "Transaction failed") };
    }
  }, [accountId]);

  const value = useMemo(() => ({ ready, accountId, modules, open, setOpen, connect, disconnect, call }), [ready, accountId, modules, open, connect, disconnect, call]);
  return <WalletCtx.Provider value={value}>{children}</WalletCtx.Provider>;
}

export function useWallet() {
  const c = useContext(WalletCtx);
  if (!c) throw new Error("useWallet outside provider");
  return c;
}
