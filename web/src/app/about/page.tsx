"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { Eyebrow, Reveal } from "@/components/bits";
import { Mark } from "@/components/Logo";
import { PluckWire } from "@/components/PluckWire";
import { RULES } from "@/lib/rules";
import { FACTORY, REPO, TOKEN_CODE_HASH, explorerAcct } from "@/lib/config";

const FAQ = [
  ["Is this real or a simulation?", "Real. Every buy, sell, launch and rug attempt is a NEAR testnet transaction. Blocked attempts are failed transactions you can open on NearBlocks; the panic message names the rule."],
  ["Who can change a token after launch?", "Nobody. The factory creates the token account without any access key, so there is no key to sign a redeploy. The code has no setter for rules and no mint path. The only change allowed is lowering the creator fee."],
  ["Where does the liquidity live?", "Inside the token contract, on a constant-product bonding curve with 30 NEAR of virtual depth. NEAR enters through buys and leaves only through sells priced by the curve. No LP token, no withdraw."],
  ["What does the creator get?", "A fee on every trade (capped at 5%, launch value is the ceiling) and an optional allocation of up to 10% that vests linearly. Locked tokens can't be sold or sent."],
  ["Is this audited?", "No. It is a hackathon build on testnet with unit tests for every rule. Don't use it with real money."],
  ["How is the audit feed built?", "Successful actions are stored on-chain in a 64-entry event log. Blocked attempts can't write state (the transaction reverts), so the feed reads failed transactions to the token account from FastNEAR's indexer and parses the TRIPWIRE[RULE] code out of the receipt."],
];

export default function About() {
  return (
    <div>
      <section className="mx-auto max-w-5xl px-5 pt-16">
        <Eyebrow>about tripwire</Eyebrow>
        <h1 className="mt-4 font-display text-[clamp(2.8rem,7vw,6rem)] font-extrabold leading-[0.92] tracking-[-0.05em]">Rug pulls run on promises. <span className="text-armed">So we deleted the promises.</span></h1>
        <div className="mt-8 grid gap-6 text-lg text-paper/80 md:grid-cols-2">
          <p>Meme tokens die the same few ways. The dev sells the team bag. Someone mints more. The fee climbs to 30% overnight. The liquidity disappears. Each of those starts with a sentence like “LP is locked” or “team tokens are vested”, and nobody can check it until it&apos;s too late.</p>
          <p>Tripwire turns those sentences into code. A token launched here carries its limits inside its own NEAR contract, on an account with no keys. Try to break a rule and the transaction fails on-chain with the rule&apos;s name in the error. The joke stays a joke. The rules stop being one.</p>
        </div>
      </section>
      <PluckWire height={150} className="mt-12" label="this wire is the product" />

      <section className="mx-auto max-w-6xl px-5 pt-16">
        <Reveal><Eyebrow>architecture</Eyebrow><h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.03em] md:text-5xl">Two contracts, zero keys where it matters.</h2></Reveal>
        <Reveal delay={0.1}>
          <div className="mt-10 overflow-x-auto rounded-3xl border border-line bg-ink-2 p-6">
            <svg viewBox="0 0 980 300" className="min-w-[760px]" fontFamily="var(--font-jbm)" fontSize="13">
              {[
                { x: 20, y: 110, w: 180, t: "creator wallet", s: "launch(rules) + 0.3 Ⓝ" },
                { x: 290, y: 110, w: 220, t: FACTORY, s: "factory · validates & creates" },
                { x: 610, y: 30, w: 340, t: "sym." + FACTORY, s: "global code " + TOKEN_CODE_HASH.slice(0, 10) + "… · 0 keys" },
                { x: 610, y: 190, w: 340, t: "traders / attackers", s: "buy · sell · ft_transfer · rug attempts" },
              ].map((b, i) => (
                <motion.g key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15 }}>
                  <rect x={b.x} y={b.y} width={b.w} height="78" rx="16" fill="#0a0a0b" stroke={i === 2 ? "#d4ff3a" : "#2a2a2e"} strokeWidth="1.5" />
                  <text x={b.x + 16} y={b.y + 32} fill="#f2efe6" fontWeight="700">{b.t}</text>
                  <text x={b.x + 16} y={b.y + 56} fill="#8c8a83" fontSize="11.5">{b.s}</text>
                </motion.g>
              ))}
              {[
                "M200 149 L290 149", "M510 140 C560 140 560 70 610 70", "M780 190 L780 108",
              ].map((d, i) => (
                <motion.path key={d} d={d} fill="none" stroke={i === 2 ? "#ff3b1f" : "#d4ff3a"} strokeWidth="2" strokeDasharray="6 6" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 0.9, delay: 0.5 + i * 0.3 }} />
              ))}
              <text x="214" y="138" fill="#8c8a83" fontSize="11">tx</text>
              <text x="530" y="98" fill="#8c8a83" fontSize="11">create_account · use_global_contract · new()</text>
              <text x="792" y="156" fill="#ff3b1f" fontSize="11">rule broken → TRIPWIRE[RULE] panic</text>
              <text x="792" y="172" fill="#8c8a83" fontSize="11">tx fails, nothing moves</text>
            </svg>
          </div>
        </Reveal>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            ["Factory", `${FACTORY} validates the symbol, creates a sub-account, attaches pinned global token code by hash, calls new() with the rules, and records the launch. It never adds a key.`],
            ["Token", "One NEP-141 contract per token: balances, a constant-product curve, creator fees, vesting, a 64-entry event log, and every rule check. Rule failures panic with a machine-readable code."],
            ["App", "Next.js on Vercel. NEAR Wallet Selector for signing. Reads come from RPC. The audit feed parses failed receipts from FastNEAR. A sandbox creator lets anyone fire real rug attempts without a wallet."],
          ].map(([t, d]) => (
            <Reveal key={t}><div className="h-full rounded-3xl border border-line bg-ink-2 p-6"><p className="font-display text-2xl font-bold">{t}</p><p className="mt-2 text-paper/70">{d}</p></div></Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pt-20">
        <Reveal><Eyebrow>the rulebook</Eyebrow><h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.03em] md:text-5xl">Ten rules, each with an error code.</h2></Reveal>
        <div className="mt-8 overflow-hidden rounded-3xl border border-line">
          {RULES.map((r, i) => (
            <Reveal key={r.code} delay={i * 0.02}>
              <div className="grid gap-2 border-b border-line bg-ink-2 px-6 py-5 last:border-0 md:grid-cols-[60px_220px_1fr_1fr] md:items-center">
                <span className="font-mono text-xs text-mute">{r.n}</span>
                <span className="font-mono text-sm font-bold text-armed">{r.code}</span>
                <span className="text-mute line-through decoration-trip/70">{r.promise}</span>
                <span className="text-paper/85">{r.enforced.replace(/`/g, "")}</span>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 pt-20">
        <Reveal><Eyebrow>questions</Eyebrow><h2 className="mt-3 font-display text-4xl font-bold tracking-[-0.03em]">FAQ</h2></Reveal>
        <div className="mt-6 divide-y divide-line rounded-3xl border border-line bg-ink-2">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group px-6 py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-lg font-semibold">{q}<span className="font-mono text-armed transition group-open:rotate-45">+</span></summary>
              <p className="mt-3 text-paper/75">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-5 pt-20 text-center">
        <Mark size={72} />
        <p className="mt-4 font-display text-3xl font-bold">Built for the NEAR Hackathon · Memecoins With Mechanics</p>
        <p className="mt-2 text-mute">Open source, MIT licensed, testnet only.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3 font-mono text-xs uppercase tracking-[0.14em]">
          <a href={REPO} target="_blank" rel="noreferrer" className="rounded-full border border-line px-4 py-2 hover:border-armed">Source & docs ↗</a>
          <a href={explorerAcct(FACTORY)} target="_blank" rel="noreferrer" className="rounded-full border border-line px-4 py-2 hover:border-armed">Factory on NearBlocks ↗</a>
          <Link href="/t/GRUG#rug" className="rounded-full bg-trip px-4 py-2 font-bold text-ink">Rug lab →</Link>
        </div>
      </section>
    </div>
  );
}
