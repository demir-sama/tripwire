"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { useWallet } from "@/components/wallet";
import { fireTrip } from "@/components/TripOverlay";
import { SANDBOX_ACTIONS } from "@/lib/sandbox";
import { SANDBOX_CREATOR, SANDBOX_SYMBOL, explorerTx } from "@/lib/config";
import { compact, fmtNear, tokens, toYocto } from "@/lib/format";
import type { Info, WalletStatus } from "@/lib/types";

type Attack = { id: string; label: string; verb: string; method: string; args: Record<string, unknown>; deposit?: string; expect: string; story: string; creatorOnly?: boolean };

function walletAttacks(info: Info, status: WalletStatus | null, isCreator: boolean): Attack[] {
  const maxSell = BigInt(info.max_sell_tokens);
  const dumpVesting = maxSell / 2n > 0n ? maxSell / 2n : 1n;
  // NEAR needed so tokens_out exceeds max buy: n > maxBuy * N / (T - maxBuy); 30% headroom plus fee.
  const T = BigInt(info.curve_tokens), N = BigInt(info.virtual_near) + BigInt(info.curve_near), mb = BigInt(info.max_buy_tokens);
  const need = (mb * N) / (T - mb);
  const whale = (need * 13n) / 10n + (need * BigInt(info.rules.fee_bps)) / 10000n + BigInt(toYocto("0.00125"));
  const list: Attack[] = [
    { id: "dump", label: "Dump the dev bag", verb: `sell ${compact(tokens(dumpVesting))} while vesting`, method: "sell", args: { amount: dumpVesting.toString() }, deposit: "1", expect: "VESTING_LOCK", story: "Cash out the creator allocation early.", creatorOnly: true },
    { id: "megadump", label: "Dump over the limit", verb: `sell ${compact(tokens(maxSell * 3n))} in one tx`, method: "sell", args: { amount: (maxSell * 3n).toString() }, deposit: "1", expect: "MAX_SELL", story: "One giant market sell." },
    { id: "mint", label: "Print more supply", verb: `mint ${compact(tokens(info.total_supply))}`, method: "mint", args: { amount: info.total_supply }, expect: "FIXED_SUPPLY", story: "Double the supply, sell into holders." },
    { id: "fee", label: "Crank the fee", verb: `set_fee(${info.rules.fee_bps + 200})`, method: "set_fee", args: { fee_bps: info.rules.fee_bps + 200 }, expect: "FEE_RATCHET", story: "Raise the tax once people are in." },
    { id: "drain", label: "Pull the liquidity", verb: "withdraw_liquidity()", method: "withdraw_liquidity", args: {}, expect: "LIQUIDITY_LOCK", story: `Take the ${fmtNear(info.curve_near, 3)} NEAR in the curve.` },
    { id: "rules", label: "Rewrite the rules", verb: "set_rules(none)", method: "set_rules", args: { rules: null }, expect: "IMMUTABLE_RULES", story: "Switch every limit off." },
    { id: "handoff", label: "Hand off to a burner", verb: "transfer_ownership()", method: "transfer_ownership", args: { new_owner: "burner-wallet.testnet" }, expect: "IMMUTABLE_RULES", story: "Move control to a fresh wallet." },
    { id: "upgrade", label: "Swap the contract", verb: "upgrade()", method: "upgrade", args: {}, expect: "IMMUTABLE_CODE", story: "Ship a backdoored version." },
    { id: "whale", label: "Snipe the curve", verb: `buy with ${fmtNear(whale, 3)} NEAR`, method: "buy", args: {}, deposit: whale.toString(), expect: "MAX_BUY", story: "Sweep a big share in one buy. Refunded when it trips." },
  ];
  void status;
  return list.filter((a) => !a.creatorOnly || (isCreator && info.creator_locked !== "0"));
}

export function RugLab({ info, account, status, onDone }: { info: Info; account: string; status: WalletStatus | null; onDone: () => void }) {
  const { accountId, setOpen, call } = useWallet();
  const sandbox = info.symbol === SANDBOX_SYMBOL;
  const [mode, setMode] = useState<"sandbox" | "wallet">(sandbox ? "sandbox" : "wallet");
  const [busy, setBusy] = useState<string | null>(null);
  const [res, setRes] = useState<Record<string, { rule?: string; hash?: string | null; err?: string; ok?: boolean }>>({});
  const isCreator = accountId === info.creator;
  const attacks: Attack[] = mode === "sandbox" ? SANDBOX_ACTIONS.map((a) => ({ ...a, deposit: a.depositNear ? toYocto(a.depositNear) : undefined })) : walletAttacks(info, status, isCreator);

  async function fire(a: Attack) {
    setBusy(a.id);
    try {
      if (mode === "sandbox") {
        const r = await fetch("/api/sandbox", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: a.id }) }).then((x) => x.json());
        if (r.error) setRes((s) => ({ ...s, [a.id]: { err: r.error } }));
        else {
          setRes((s) => ({ ...s, [a.id]: { rule: r.rule, hash: r.hash, ok: !r.blocked } }));
          if (r.blocked) fireTrip({ rule: r.rule, message: r.message, hash: r.hash, method: a.method, signer: SANDBOX_CREATOR });
        }
      } else {
        if (!accountId) { setOpen(true); return; }
        const r = await call(account, a.method, a.args, a.deposit ?? "0", "60000000000000");
        if (r.ok) setRes((s) => ({ ...s, [a.id]: { ok: true, hash: r.hash } }));
        else if ("cancelled" in r && r.cancelled) setRes((s) => ({ ...s, [a.id]: { err: "cancelled" } }));
        else {
          setRes((s) => ({ ...s, [a.id]: { rule: r.rule ?? undefined, hash: r.hash, err: r.rule ? undefined : r.message } }));
          if (r.rule) fireTrip({ rule: r.rule, message: r.message, hash: r.hash, method: a.method, signer: accountId });
        }
      }
    } finally { setBusy(null); setTimeout(onDone, 1200); }
  }

  return (
    <div id="rug" className="scroll-mt-24 overflow-hidden rounded-3xl border border-trip/40 bg-ink-2">
      <div className="hazard h-2 opacity-70" />
      <div className="p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-trip">rug lab</p>
            <h2 className="mt-1 font-display text-4xl font-bold tracking-[-0.03em]">Try to rug ${info.symbol}.</h2>
            <p className="mt-1 max-w-xl text-sm text-paper/70">Each button sends a real NEAR testnet transaction. Watch the contract refuse it and name the rule.</p>
          </div>
          <div className="flex gap-1 rounded-full border border-line p-1">
            {sandbox && (
              <button onClick={() => setMode("sandbox")} className={`relative rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] ${mode === "sandbox" ? "text-ink" : "text-mute"}`}>
                {mode === "sandbox" && <motion.span layoutId="rugmode" className="absolute inset-0 rounded-full bg-trip" />}<span className="relative">as the creator (no wallet)</span>
              </button>
            )}
            <button onClick={() => setMode("wallet")} className={`relative rounded-full px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] ${mode === "wallet" ? "text-ink" : "text-mute"}`}>
              {mode === "wallet" && <motion.span layoutId="rugmode" className="absolute inset-0 rounded-full bg-trip" />}<span className="relative">with your wallet</span>
            </button>
          </div>
        </div>
        <p className="mt-3 font-mono text-[11px] text-mute">
          {mode === "sandbox" ? <>signer: <span className="text-paper">{SANDBOX_CREATOR}</span>, the real creator of $GRUG, holding a vesting 5% allocation. A server key signs; nothing is simulated.</> : accountId ? <>signer: <span className="text-paper">{accountId}</span>{isCreator ? " · you created this token" : " · rules apply to everyone, creator or not"}</> : "connect a testnet wallet to sign the attacks yourself"}
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {attacks.map((a, i) => {
            const r = res[a.id];
            return (
              <motion.button key={a.id} onClick={() => fire(a)} disabled={!!busy} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} whileHover={{ y: -3 }} whileTap={{ scale: 0.97 }}
                className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition-colors ${r?.rule ? "border-trip bg-trip/5" : "border-line bg-ink hover:border-trip/70"} disabled:cursor-wait`}>
                <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.16em]"><span className="text-mute">{a.method}()</span><span className="text-trip/70">expect {a.expect}</span></div>
                <p className="mt-2 font-display text-lg font-bold">{a.label}</p>
                <p className="text-xs text-paper/60">{a.story}</p>
                <p className="mt-2 font-mono text-[11px] text-paper/80">{a.verb}</p>
                <div className="mt-3 min-h-5 font-mono text-[11px]">
                  {busy === a.id ? <span className="text-warn"><span className="blink">▮</span> signing & sending…</span>
                    : r?.rule ? <span className="text-trip">✕ TRIPPED {r.rule} {r.hash && <a onClick={(e) => e.stopPropagation()} href={explorerTx(r.hash)} target="_blank" rel="noreferrer" className="underline">tx ↗</a>}</span>
                    : r?.ok ? <span className="text-warn">went through?! {r.hash && <a onClick={(e) => e.stopPropagation()} href={explorerTx(r.hash)} target="_blank" rel="noreferrer" className="underline">tx ↗</a>}</span>
                    : r?.err ? <span className="text-mute">{r.err}</span>
                    : <span className="text-mute transition group-hover:text-trip">attempt →</span>}
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
