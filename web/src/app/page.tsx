"use client";
import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { PluckWire } from "@/components/PluckWire";
import { Counter, Eyebrow, Marquee, Reveal, SplitWords, TokenIcon } from "@/components/bits";
import { RULES } from "@/lib/rules";
import { useTokens } from "@/lib/useTokens";
import { compact, fmtNear, near, pct, pricePerMillion, tokens } from "@/lib/format";
import { FACTORY } from "@/lib/config";

export default function Home() {
  const { rows, error } = useTokens();
  const [trip, setTrip] = useState(0);
  const totalTrips = rows?.reduce((a, r) => a + (r.trips ?? 0), 0) ?? 0;
  const trades = rows?.reduce((a, r) => a + (r.info?.trades ?? 0), 0) ?? 0;
  return (
    <>
      <section className="gridlines relative overflow-hidden">
        <div className="mx-auto max-w-7xl px-5 pb-6 pt-16 md:pt-24">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-armed/40 bg-armed/10 px-3 py-1 font-mono text-[11px] uppercase tracking-[0.2em] text-armed">NEAR testnet · live</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-mute">memecoins with mechanics</span>
          </motion.div>
          <h1 className="mt-6 max-w-5xl font-display text-[clamp(3rem,9vw,8.5rem)] font-extrabold leading-[0.88] tracking-[-0.055em]">
            <SplitWords text="The joke" />
            <br />
            <SplitWords text="needs" delay={0.15} /> <span className="relative inline-block"><SplitWords text="rules." delay={0.22} className="text-armed" /></span>
          </h1>
          <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }} className="mt-7 max-w-2xl text-lg text-paper/80 md:text-xl">
            Tripwire launches meme tokens whose sell limits, max wallet, creator fee and liquidity lock are enforced by a NEAR contract. Not promised in a thread. When someone tries to rug, the transaction fails on-chain and the feed shows which rule caught it.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }} className="mt-9 flex flex-wrap gap-3">
            <Link href="/launch" className="group rounded-full bg-armed px-6 py-3.5 font-mono text-sm font-bold uppercase tracking-[0.14em] text-ink transition hover:-translate-y-0.5">Launch a token <span className="inline-block transition group-hover:translate-x-1">→</span></Link>
            <Link href="/t/GRUG" onMouseEnter={() => setTrip((t) => t + 1)} className="rounded-full border border-trip/60 px-6 py-3.5 font-mono text-sm font-bold uppercase tracking-[0.14em] text-trip transition hover:bg-trip hover:text-ink">Try to rug GRUG</Link>
          </motion.div>
        </div>
        <PluckWire height={190} trip={trip} label="pluck the wire" />
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-px border-t border-line bg-line md:grid-cols-4">
          {[
            { k: "tokens launched", v: rows?.length ?? 0 },
            { k: "rugs blocked on-chain", v: totalTrips, hot: true },
            { k: "trades through rules", v: trades },
            { k: "rules per token", v: RULES.length },
          ].map((s) => (
            <div key={s.k} className="bg-ink px-5 py-6">
              <div className={`font-display text-4xl font-bold md:text-5xl ${s.hot ? "text-trip" : ""}`}><Counter value={s.v} /></div>
              <Eyebrow className="mt-1">{s.k}</Eyebrow>
            </div>
          ))}
        </div>
      </section>

      <Marquee items={RULES.map((r) => `${r.code} armed`)} />

      <section className="mx-auto max-w-7xl px-5 pt-24">
        <Reveal>
          <Eyebrow>01 · promises vs code</Eyebrow>
          <h2 className="mt-3 max-w-3xl font-display text-5xl font-bold tracking-[-0.04em] md:text-6xl">Every rug starts with a promise. We replaced ten of them.</h2>
        </Reveal>
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {RULES.map((r, i) => (
            <Reveal key={r.code} delay={i * 0.04}>
              <div className="group relative h-56 overflow-hidden rounded-2xl border border-line bg-ink-2 p-5 transition-colors hover:border-armed">
                <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.2em] text-mute"><span>{r.n}</span><span className="pulse-dot h-1.5 w-1.5 rounded-full bg-armed" /></div>
                <p className="mt-4 font-display text-xl font-semibold leading-tight">{r.title}</p>
                <div className="absolute inset-x-5 bottom-5">
                  <p className="text-sm text-mute line-through decoration-trip decoration-2 transition-all duration-300 group-hover:-translate-y-2 group-hover:opacity-0">{r.promise}</p>
                  <p className="absolute bottom-0 translate-y-4 text-sm leading-snug text-paper opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">{r.enforced.replace(/`/g, "")}</p>
                </div>
                <p className="absolute right-4 top-12 font-mono text-[10px] text-armed/70">{r.code}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pt-28">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>02 · live on {FACTORY}</Eyebrow>
            <h2 className="mt-3 font-display text-5xl font-bold tracking-[-0.04em] md:text-6xl">Armed tokens</h2>
          </div>
          <Link href="/launch" className="font-mono text-xs uppercase tracking-[0.16em] text-armed hover:underline">+ launch yours</Link>
        </Reveal>
        {error && <p className="mt-8 font-mono text-sm text-trip">Couldn&apos;t reach NEAR RPC: {error}</p>}
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {!rows && Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-60 animate-pulse rounded-3xl border border-line bg-ink-2" />)}
          {rows?.map((t, i) => {
            const inf = t.info;
            const sold = inf ? 1 - tokens(inf.curve_tokens) / (tokens(inf.total_supply) - tokens(inf.creator_alloc)) : 0;
            return (
              <Reveal key={t.account_id} delay={i * 0.05}>
                <Link href={`/t/${t.symbol}`} className="group block rounded-3xl border border-line bg-ink-2 p-5 transition hover:-translate-y-1 hover:border-armed">
                  <div className="flex items-center gap-4">
                    <TokenIcon symbol={t.symbol} icon={inf?.icon} size={56} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-xl font-bold">{t.name}</p>
                      <p className="font-mono text-xs text-mute">${t.symbol} · by {t.creator}</p>
                    </div>
                    {(t.trips ?? 0) > 0 && <span className="rounded-full bg-trip/15 px-2.5 py-1 font-mono text-[11px] text-trip">{t.trips} blocked</span>}
                  </div>
                  {inf && (
                    <>
                      <p className="mt-4 line-clamp-2 min-h-10 text-sm text-paper/70">{inf.tagline || "—"}</p>
                      <div className="mt-4 grid grid-cols-3 gap-2 font-mono text-[11px]">
                        <div><p className="text-mute">price / 1M</p><p className="num text-paper">{pricePerMillion(inf.price_yocto_per_token).toFixed(4)} Ⓝ</p></div>
                        <div><p className="text-mute">curve NEAR</p><p className="num text-paper">{fmtNear(inf.curve_near, 3)}</p></div>
                        <div><p className="text-mute">fee</p><p className="num text-paper">{pct(inf.rules.fee_bps)}</p></div>
                      </div>
                      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ink-3"><motion.div className="h-full bg-armed" initial={{ width: 0 }} whileInView={{ width: `${Math.max(2, sold * 100)}%` }} viewport={{ once: true }} transition={{ duration: 1 }} /></div>
                      <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-mute">{(sold * 100).toFixed(2)}% of curve sold · {compact(near(inf.volume_near))} Ⓝ volume</p>
                    </>
                  )}
                </Link>
              </Reveal>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pt-28">
        <Reveal>
          <Eyebrow>03 · how it works</Eyebrow>
          <h2 className="mt-3 max-w-3xl font-display text-5xl font-bold tracking-[-0.04em] md:text-6xl">Set the rules once. Nobody can unset them.</h2>
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            { n: "A", t: "Pick your rules", d: "Max buy, max sell, max wallet, creator fee, sell cooldown, creator vesting. Hard limits stop anything abusive: fee never above 5%, allocation never above 10%." },
            { n: "B", t: "Launch keyless", d: "The factory creates sym.tripwire.testnet running pinned global code, and adds no access keys. Once init runs, nobody can sign for that account again." },
            { n: "C", t: "Try to rug it", d: "Dump, mint, raise the fee, pull liquidity, swap the code. Each attempt is a real transaction that fails with TRIPWIRE[RULE] and shows up in the audit feed." },
          ].map((s, i) => (
            <Reveal key={s.n} delay={i * 0.08}>
              <div className="h-full rounded-3xl border border-line bg-ink-2 p-7">
                <span className="grid h-11 w-11 place-items-center rounded-full border border-armed font-display text-lg font-bold text-armed">{s.n}</span>
                <p className="mt-6 font-display text-2xl font-bold">{s.t}</p>
                <p className="mt-2 text-paper/70">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pt-28">
        <Reveal>
          <div className="relative overflow-hidden rounded-[32px] border border-trip/40 bg-gradient-to-br from-trip/15 via-ink-2 to-ink-2 p-10 md:p-14">
            <div className="hazard absolute inset-x-0 top-0 h-2 opacity-70" />
            <h3 className="max-w-2xl font-display text-4xl font-bold tracking-[-0.03em] md:text-5xl">Don&apos;t take our word for it. Try to rug GRUG.</h3>
            <p className="mt-3 max-w-xl text-paper/75">No wallet needed: a sandbox creator account signs real testnet transactions for you. Or connect a wallet and attack it yourself.</p>
            <Link href="/t/GRUG#rug" className="mt-8 inline-block rounded-full bg-trip px-6 py-3.5 font-mono text-sm font-bold uppercase tracking-[0.14em] text-ink transition hover:-translate-y-0.5">Open the rug lab →</Link>
          </div>
        </Reveal>
      </section>
    </>
  );
}
