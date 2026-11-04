"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { explorerTx } from "@/lib/config";
import { Mark } from "./Logo";

export type TripDetail = { rule: string; message: string; hash: string | null; method: string; signer?: string };
export const fireTrip = (d: TripDetail) => window.dispatchEvent(new CustomEvent<TripDetail>("tripwire:trip", { detail: d }));

/** Full-screen “TRIPPED” moment when a rug attempt fails on-chain. */
export function TripOverlay() {
  const [d, setD] = useState<TripDetail | null>(null);
  useEffect(() => {
    const h = (e: Event) => setD((e as CustomEvent<TripDetail>).detail);
    window.addEventListener("tripwire:trip", h);
    return () => window.removeEventListener("tripwire:trip", h);
  }, []);
  useEffect(() => {
    if (!d) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setD(null);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [d]);
  return (
    <AnimatePresence>
      {d && (
        <motion.div className="fixed inset-0 z-[70] grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setD(null)}>
          <motion.div className="absolute inset-0 bg-trip/20 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.6] }} transition={{ duration: 0.5 }} />
          <motion.div className="hazard absolute left-0 right-0 top-[18%] h-6 opacity-80" initial={{ x: "-100%" }} animate={{ x: 0 }} transition={{ duration: 0.35, ease: [0.2, 0.9, 0.2, 1] }} />
          <motion.div className="hazard absolute bottom-[18%] left-0 right-0 h-6 opacity-80" initial={{ x: "100%" }} animate={{ x: 0 }} transition={{ duration: 0.35, ease: [0.2, 0.9, 0.2, 1], delay: 0.05 }} />
          <motion.div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl rounded-[28px] border-2 border-trip bg-ink p-7 shadow-[0_0_120px_rgba(255,59,31,.35)]"
            initial={{ scale: 1.25, rotate: -4, opacity: 0 }}
            animate={{ scale: 1, rotate: [-4, 2, -1, 0], opacity: 1, x: [0, -10, 8, -5, 3, 0] }}
            transition={{ duration: 0.55, ease: "easeOut" }}
          >
            <div className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.2em] text-trip"><Mark size={22} tripped interactive={false} /> transaction rejected on-chain</div>
            <h2 className="mt-3 font-display text-6xl font-extrabold leading-none tracking-[-0.05em] text-trip md:text-7xl">TRIPPED</h2>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-trip px-3 py-1 font-mono text-sm font-bold text-ink">RULE · {d.rule}</div>
            <p className="mt-4 text-lg leading-snug text-paper">{d.message}</p>
            <p className="mt-3 font-mono text-xs text-mute">attempted: <span className="text-paper">{d.method}()</span>{d.signer ? <> by <span className="text-paper">{d.signer}</span></> : null} · nothing moved, deposit refunded</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {d.hash ? (
                <a href={explorerTx(d.hash)} target="_blank" rel="noreferrer" className="rounded-full border border-paper/30 px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] hover:border-paper">View failed tx ↗</a>
              ) : (
                <span className="rounded-full border border-line px-4 py-2 font-mono text-xs text-mute">locating tx hash…</span>
              )}
              <button onClick={() => setD(null)} className="rounded-full bg-paper px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.14em] text-ink">Close · esc</button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
