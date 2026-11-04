"use client";
import { AnimatePresence, motion } from "motion/react";
import { RULES, ruleValue, type RuleCode } from "@/lib/rules";
import type { Info, Trip } from "@/lib/types";
import { compact, tokens } from "@/lib/format";
import { explorerAcct } from "@/lib/config";

export function RuleBoard({ info, trips, keys, account, globalHash, flash }: { info: Info; trips: Trip[]; keys: number | null; account: string; globalHash: string | null; flash: string | null }) {
  const count = (c: RuleCode) => trips.filter((t) => t.rule === c).length;
  const vestPct = info.creator_alloc === "0" ? 100 : 100 - (tokens(info.creator_locked) / tokens(info.creator_alloc)) * 100;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {RULES.map((r, i) => {
        const n = count(r.code);
        const hot = flash === r.code;
        return (
          <motion.div key={r.code} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, x: hot ? [0, -6, 6, -3, 0] : 0 }} transition={{ delay: hot ? 0 : i * 0.03, duration: hot ? 0.4 : 0.4 }}
            className={`relative overflow-hidden rounded-2xl border p-4 transition-colors duration-500 ${hot ? "border-trip bg-trip/10" : "border-line bg-ink-2"}`}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mute">{r.n} · {r.code}</span>
              <span className={`flex items-center gap-1.5 rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] ${hot ? "bg-trip text-ink" : "bg-armed/10 text-armed"}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${hot ? "bg-ink" : "pulse-dot bg-armed"}`} />{hot ? "tripped" : "armed"}
              </span>
            </div>
            <p className="mt-2 font-display text-lg font-semibold">{r.title}</p>
            <p className="num font-mono text-sm text-paper">{ruleValue(r.code, info)}</p>
            {r.code === "VESTING_LOCK" && info.creator_alloc !== "0" && (
              <div className="mt-2">
                <div className="h-1 overflow-hidden rounded-full bg-ink-3"><motion.div className="h-full bg-armed" initial={{ width: 0 }} animate={{ width: `${vestPct}%` }} /></div>
                <p className="mt-1 font-mono text-[10px] text-mute">{compact(tokens(info.creator_locked))} still locked · {vestPct.toFixed(1)}% vested</p>
              </div>
            )}
            {r.code === "IMMUTABLE_CODE" && (
              <p className="mt-1 font-mono text-[10px] text-mute">
                live check: <a href={explorerAcct(account)} target="_blank" rel="noreferrer" className={keys === 0 ? "text-armed underline" : "text-warn underline"}>{keys === null ? "…" : `${keys} access keys`}</a>
                {globalHash ? <> · global code {globalHash.slice(0, 8)}…</> : null}
              </p>
            )}
            {r.code === "FEE_RATCHET" && <p className="mt-1 font-mono text-[10px] text-mute">launch cap {(info.fee_cap_bps / 100).toFixed(2)}% · current {(info.rules.fee_bps / 100).toFixed(2)}%</p>}
            <AnimatePresence>{n > 0 && (
              <motion.span key={n} initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="absolute bottom-3 right-3 rounded-full bg-trip/15 px-2 py-0.5 font-mono text-[10px] text-trip">blocked ×{n}</motion.span>
            )}</AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
