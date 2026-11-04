"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { ChainEvent, Trip } from "@/lib/types";
import { ago, compact, fmtNear, short, tokens } from "@/lib/format";
import { explorerTx, explorerAcct } from "@/lib/config";

type Row = { key: string; ts: number; kind: "trip" | "event"; trip?: Trip; ev?: ChainEvent };
const KIND: Record<string, string> = { launch: "Launched", buy: "Buy", sell: "Sell", transfer: "Transfer", claim_fees: "Fees claimed", fee_lowered: "Fee lowered" };

export function Feed({ events, trips, symbol }: { events: ChainEvent[]; trips: Trip[]; symbol: string }) {
  const [tab, setTab] = useState<"all" | "blocked" | "activity">("all");
  const rows: Row[] = [
    ...trips.map((t) => ({ key: t.hash, ts: t.ts_ms, kind: "trip" as const, trip: t })),
    ...events.map((e) => ({ key: `e${e.id}`, ts: e.ts_ms, kind: "event" as const, ev: e })),
  ].filter((r) => tab === "all" || (tab === "blocked" ? r.kind === "trip" : r.kind === "event")).sort((a, b) => b.ts - a.ts).slice(0, 60);
  return (
    <div className="rounded-3xl border border-line bg-ink-2">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div><p className="font-display text-xl font-bold">Audit feed</p><p className="font-mono text-[11px] text-mute">contract events + failed txs carrying TRIPWIRE[RULE], straight from chain</p></div>
        <div className="flex gap-1 rounded-full border border-line p-1">
          {(["all", "blocked", "activity"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`relative rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-[0.14em] ${tab === t ? "text-ink" : "text-mute"}`}>
              {tab === t && <motion.span layoutId="feedtab" className={`absolute inset-0 rounded-full ${t === "blocked" ? "bg-trip" : "bg-paper"}`} />}<span className="relative">{t}</span>
            </button>
          ))}
        </div>
      </div>
      <ul className="max-h-[560px] divide-y divide-line overflow-y-auto">
        <AnimatePresence initial={false}>
          {rows.map((r) => (
            <motion.li key={r.key} layout initial={{ opacity: 0, x: -16, backgroundColor: r.kind === "trip" ? "rgba(255,59,31,.25)" : "rgba(212,255,58,.12)" }} animate={{ opacity: 1, x: 0, backgroundColor: "rgba(0,0,0,0)" }} transition={{ duration: 0.9 }} className="px-5 py-3">
              {r.trip ? (
                <div className="flex gap-3">
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rotate-45 bg-trip" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm"><span className="font-mono font-bold text-trip">BLOCKED · {r.trip.rule}</span> <span className="text-mute">·</span> <a className="hover:underline" href={explorerAcct(r.trip.signer)} target="_blank" rel="noreferrer">{short(r.trip.signer, 24)}</a> <span className="text-mute">tried</span> <span className="font-mono">{r.trip.method}()</span></p>
                    <p className="mt-0.5 text-xs text-paper/60">{r.trip.message}</p>
                  </div>
                  <a href={explorerTx(r.trip.hash)} target="_blank" rel="noreferrer" className="shrink-0 font-mono text-[11px] text-mute hover:text-paper">{ago(r.ts)} ↗</a>
                </div>
              ) : r.ev ? (
                <div className="flex gap-3">
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${r.ev.kind === "sell" ? "bg-warn" : "bg-armed"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm"><span className="font-semibold">{KIND[r.ev.kind] ?? r.ev.kind}</span> <span className="text-mute">·</span> <a className="hover:underline" href={explorerAcct(r.ev.actor)} target="_blank" rel="noreferrer">{short(r.ev.actor, 24)}</a>
                      {r.ev.tokens !== "0" && <> <span className="text-mute">·</span> <span className="num font-mono">{compact(tokens(r.ev.tokens))} ${symbol}</span></>}
                      {r.ev.near !== "0" && <> <span className="text-mute">·</span> <span className="num font-mono">{fmtNear(r.ev.near)} Ⓝ</span></>}</p>
                    <p className="mt-0.5 text-xs text-paper/50">{r.ev.note}</p>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] text-mute">{ago(r.ts)}</span>
                </div>
              ) : null}
            </motion.li>
          ))}
        </AnimatePresence>
        {rows.length === 0 && <li className="px-5 py-10 text-center font-mono text-sm text-mute">nothing yet</li>}
      </ul>
    </div>
  );
}
