"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useWallet, type TxResult } from "@/components/wallet";
import { fireTrip } from "@/components/TripOverlay";
import { view } from "@/lib/near";
import { compact, fmtNear, near, pct, toRawTokens, toYocto, tokens } from "@/lib/format";
import { explorerTx } from "@/lib/config";
import type { Info, WalletStatus } from "@/lib/types";

const STORAGE = "1250000000000000000000";

export function TradePanel({ info, account, status, onDone }: { info: Info; account: string; status: WalletStatus | null; onDone: () => void }) {
  const { accountId, setOpen, call } = useWallet();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amt, setAmt] = useState("0.1");
  const [quote, setQuote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<TxResult | null>(null);

  useEffect(() => { setAmt(side === "buy" ? "0.1" : status ? String(Math.floor(Math.min(tokens(status.balance), tokens(info.max_sell_tokens)) / 2)) : "1000"); setQuote(null); }, [side]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const n = Number(amt);
    if (!(n > 0)) return setQuote(null);
    const t = setTimeout(() => {
      (side === "buy" ? view<string>(account, "quote_buy", { near_in: toYocto(amt) }) : view<string>(account, "quote_sell", { amount: toRawTokens(amt) })).then(setQuote).catch(() => setQuote(null));
    }, 250);
    return () => clearTimeout(t);
  }, [amt, side, account]);

  // Client-side preview of which rule the contract will enforce (the contract is the judge).
  const warn: { rule: string; text: string } | null = (() => {
    if (!quote) return null;
    if (side === "buy") {
      const out = BigInt(quote);
      if (out > BigInt(info.max_buy_tokens)) return { rule: "MAX_BUY", text: `${compact(tokens(quote))} > max buy ${compact(tokens(info.max_buy_tokens))}` };
      const bal = BigInt(status?.balance ?? "0");
      if (bal + out > BigInt(info.max_wallet_tokens)) return { rule: "MAX_WALLET", text: `you'd hold ${compact(tokens(bal + out))} > ${compact(tokens(info.max_wallet_tokens))}` };
    } else {
      const a = BigInt(toRawTokens(amt));
      if (a > BigInt(info.max_sell_tokens)) return { rule: "MAX_SELL", text: `${compact(tokens(a))} > max sell ${compact(tokens(info.max_sell_tokens))}` };
      if (status && accountId === info.creator && BigInt(status.balance) - a < BigInt(status.locked)) return { rule: "VESTING_LOCK", text: `${compact(tokens(status.locked))} of your bag is still vesting` };
      if (status && status.sell_ready_in_sec > 0) return { rule: "SELL_COOLDOWN", text: `next sell in ${status.sell_ready_in_sec}s` };
      if (status && a > BigInt(status.balance)) return { rule: "BALANCE", text: "more than you hold" };
    }
    return null;
  })();

  async function go() {
    if (!accountId) return setOpen(true);
    setBusy(true); setLast(null);
    let r: TxResult;
    if (side === "buy") {
      const dep = BigInt(toYocto(amt)) + (status?.registered ? 0n : BigInt(STORAGE));
      r = await call(account, "buy", {}, dep.toString(), "60000000000000");
    } else {
      r = await call(account, "sell", { amount: toRawTokens(amt) }, "1", "60000000000000");
    }
    setBusy(false); setLast(r);
    if (!r.ok && r.rule && !r.rule.startsWith("ERR_")) fireTrip({ rule: r.rule, message: r.message, hash: r.hash, method: side, signer: accountId });
    onDone();
  }

  const isCreator = accountId === info.creator;
  return (
    <div className="rounded-3xl border border-line bg-ink-2 p-5">
      <div className="grid grid-cols-2 gap-1 rounded-full border border-line p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button key={s} onClick={() => setSide(s)} className={`relative rounded-full py-2 font-mono text-xs font-bold uppercase tracking-[0.16em] ${side === s ? "text-ink" : "text-mute"}`}>
            {side === s && <motion.span layoutId="side" className={`absolute inset-0 rounded-full ${s === "buy" ? "bg-armed" : "bg-warn"}`} />}<span className="relative">{s}</span>
          </button>
        ))}
      </div>
      <label className="mt-5 block">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">{side === "buy" ? "you pay (NEAR)" : `you sell ($${info.symbol})`}</span>
        <input value={amt} onChange={(e) => setAmt(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="num mt-1 w-full rounded-xl border border-line bg-ink px-4 py-3 font-mono text-2xl outline-none focus:border-armed" />
      </label>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {(side === "buy" ? ["0.05", "0.1", "0.25", "1"] : status ? [0.25, 0.5, 1].map((f) => String(Math.floor(tokens(status.balance) * f))) : []).map((v, i) => (
          <button key={i} onClick={() => setAmt(v)} className="rounded-full border border-line px-2.5 py-1 font-mono text-[11px] text-mute hover:border-paper/40 hover:text-paper">{side === "buy" ? `${v} Ⓝ` : ["25%", "50%", "max"][i]}</button>
        ))}
      </div>
      <div className="mt-4 rounded-xl bg-ink px-4 py-3 font-mono text-xs">
        <div className="flex justify-between"><span className="text-mute">you get ≈</span><span className="num text-paper">{quote ? (side === "buy" ? `${compact(tokens(quote))} $${info.symbol}` : `${fmtNear(quote)} Ⓝ`) : "—"}</span></div>
        <div className="mt-1 flex justify-between"><span className="text-mute">creator fee</span><span>{pct(info.rules.fee_bps)}</span></div>
        {side === "buy" && status && !status.registered && <div className="mt-1 flex justify-between"><span className="text-mute">first-buy storage</span><span>0.00125 Ⓝ</span></div>}
      </div>
      <AnimatePresence>{warn && (
        <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 rounded-xl border border-trip/50 bg-trip/10 px-3 py-2 font-mono text-[11px] text-trip">
          ⚠ will trip {warn.rule}: {warn.text}. Send it anyway to watch the contract refuse it.
        </motion.p>
      )}</AnimatePresence>
      <button onClick={go} disabled={busy || !(Number(amt) > 0)} className={`mt-4 w-full rounded-2xl py-3.5 font-mono text-sm font-bold uppercase tracking-[0.16em] text-ink transition enabled:hover:-translate-y-0.5 disabled:opacity-40 ${warn ? "bg-trip" : side === "buy" ? "bg-armed" : "bg-warn"}`}>
        {!accountId ? "Connect wallet" : busy ? "Waiting for wallet…" : warn ? `${side} anyway` : `${side} $${info.symbol}`}
      </button>
      {last && (
        <p className={`mt-3 font-mono text-[11px] ${last.ok ? "text-armed" : "text-trip"}`}>
          {last.ok ? "✓ confirmed on-chain" : `✕ ${last.rule ? `${last.rule}: ` : ""}${last.message}`} {last.hash && <a href={explorerTx(last.hash)} target="_blank" rel="noreferrer" className="underline">tx ↗</a>}
        </p>
      )}
      {accountId && status && (
        <div className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4 font-mono text-[11px]">
          <div><p className="text-mute">balance</p><p className="num">{compact(tokens(status.balance))}</p></div>
          <div><p className="text-mute">wallet room</p><p className="num">{compact(tokens(status.wallet_room))}</p></div>
          <div><p className="text-mute">{BigInt(status.locked) > 0n ? "locked" : "next sell"}</p><p className="num">{BigInt(status.locked) > 0n ? compact(tokens(status.locked)) : status.sell_ready_in_sec ? `${status.sell_ready_in_sec}s` : "ready"}</p></div>
        </div>
      )}
      {isCreator && <CreatorTools info={info} account={account} onDone={onDone} />}
    </div>
  );
}

function CreatorTools({ info, account, onDone }: { info: Info; account: string; onDone: () => void }) {
  const { call } = useWallet();
  const [msg, setMsg] = useState<string | null>(null);
  const run = async (m: string, a: Record<string, unknown>) => {
    setMsg("waiting for wallet…");
    const r = await call(account, m, a);
    setMsg(r.ok ? "✓ done" : `✕ ${r.message}`);
    onDone();
  };
  return (
    <div className="mt-5 border-t border-line pt-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-mute">creator · legit actions</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button onClick={() => run("claim_fees", {})} disabled={info.creator_fees_unclaimed === "0"} className="rounded-full border border-armed/50 px-3 py-1.5 font-mono text-[11px] text-armed disabled:opacity-40">claim {near(info.creator_fees_unclaimed).toFixed(4)} Ⓝ fees</button>
        <button onClick={() => run("set_fee", { fee_bps: Math.max(0, info.rules.fee_bps - 25) })} disabled={info.rules.fee_bps === 0} className="rounded-full border border-line px-3 py-1.5 font-mono text-[11px] text-paper disabled:opacity-40">lower fee to {pct(Math.max(0, info.rules.fee_bps - 25))}</button>
      </div>
      {msg && <p className="mt-2 font-mono text-[11px] text-mute">{msg}</p>}
    </div>
  );
}
