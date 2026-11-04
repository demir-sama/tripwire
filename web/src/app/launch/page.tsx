"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { useWallet } from "@/components/wallet";
import { Eyebrow, TokenIcon } from "@/components/bits";
import { Mark } from "@/components/Logo";
import { FACTORY, explorerTx, tokenAccount } from "@/lib/config";
import { view } from "@/lib/near";
import { compact, pct, toYocto } from "@/lib/format";
import { glyphDataUrl } from "@/lib/glyph";
import type { Rules, TokenEntry } from "@/lib/types";

const PRESETS: Record<string, Rules> = {
  Fortress: { max_buy_bps: 50, max_sell_bps: 25, max_wallet_bps: 100, fee_bps: 50, sell_cooldown_sec: 300, creator_alloc_bps: 300, creator_vest_days: 90 },
  Balanced: { max_buy_bps: 100, max_sell_bps: 50, max_wallet_bps: 200, fee_bps: 100, sell_cooldown_sec: 60, creator_alloc_bps: 500, creator_vest_days: 30 },
  "Loose but safe": { max_buy_bps: 300, max_sell_bps: 200, max_wallet_bps: 800, fee_bps: 200, sell_cooldown_sec: 15, creator_alloc_bps: 800, creator_vest_days: 14 },
};
const SUPPLIES = [1_000_000, 100_000_000, 1_000_000_000, 69_000_000_000, 420_000_000_000];

type Slider = { k: keyof Rules; label: string; min: number; max: number; step: number; fmt: (v: number) => string; hint: string; code: string };
const SLIDERS: Slider[] = [
  { k: "max_buy_bps", label: "Max buy per tx", min: 10, max: 500, step: 5, fmt: pct, hint: "No single buy can take more than this share of supply.", code: "MAX_BUY" },
  { k: "max_sell_bps", label: "Max sell per tx", min: 10, max: 500, step: 5, fmt: pct, hint: "Caps every dump, the creator's included.", code: "MAX_SELL" },
  { k: "max_wallet_bps", label: "Max wallet", min: 50, max: 2000, step: 10, fmt: pct, hint: "No wallet may hold more than this after a buy or transfer.", code: "MAX_WALLET" },
  { k: "fee_bps", label: "Creator fee", min: 0, max: 500, step: 5, fmt: pct, hint: "Paid to you on every trade. Can only be lowered later.", code: "FEE_RATCHET" },
  { k: "sell_cooldown_sec", label: "Sell cooldown", min: 0, max: 3600, step: 5, fmt: (v) => (v ? (v >= 60 ? `${Math.floor(v / 60)}m ${v % 60 ? (v % 60) + "s" : ""}` : `${v}s`) : "off"), hint: "Seconds each wallet waits between sells.", code: "SELL_COOLDOWN" },
  { k: "creator_alloc_bps", label: "Your allocation", min: 0, max: 1000, step: 10, fmt: pct, hint: "Minted to you at launch, locked and vesting linearly.", code: "VESTING_LOCK" },
  { k: "creator_vest_days", label: "Vesting period", min: 1, max: 365, step: 1, fmt: (v) => `${v} days`, hint: "How long until your allocation is fully unlocked.", code: "VESTING_LOCK" },
];

export default function Launch() {
  const router = useRouter();
  const { accountId, setOpen, call } = useWallet();
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [tagline, setTagline] = useState("");
  const [supply, setSupply] = useState(1_000_000_000);
  const [rules, setRules] = useState<Rules>(PRESETS.Balanced);
  const [preset, setPreset] = useState("Balanced");
  const [taken, setTaken] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ symbol: string; hash: string | null } | null>(null);

  const sym = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
  useEffect(() => {
    setTaken(null);
    if (sym.length < 2) return;
    const t = setTimeout(() => view<TokenEntry | null>(FACTORY, "token", { symbol: sym }).then((r) => setTaken(!!r)).catch(() => setTaken(null)), 350);
    return () => clearTimeout(t);
  }, [sym]);

  const set = (k: keyof Rules, v: number) => {
    setPreset("Custom");
    setRules((r) => {
      const n = { ...r, [k]: v };
      if (k === "max_buy_bps" && n.max_wallet_bps < v) n.max_wallet_bps = v;
      if (k === "max_wallet_bps" && n.max_buy_bps > v) n.max_buy_bps = v;
      return n;
    });
  };
  const problems = useMemo(() => {
    const p: string[] = [];
    if (!name.trim()) p.push("Give it a name");
    if (sym.length < 2) p.push("Symbol needs 2–10 letters or digits");
    if (taken) p.push(`$${sym} is already launched`);
    if (tagline.length > 140) p.push("Tagline max 140 characters");
    return p;
  }, [name, sym, taken, tagline]);

  async function launch() {
    if (!accountId) return setOpen(true);
    setBusy(true); setErr(null);
    const r = await call(FACTORY, "launch", { name: name.trim(), symbol: sym, tagline: tagline.trim(), icon: glyphDataUrl(sym), supply_whole: String(supply), rules }, toYocto("0.3"), "150000000000000");
    setBusy(false);
    if (r.ok && r.value !== null) { setDone({ symbol: sym, hash: r.hash }); setTimeout(() => router.push(`/t/${sym}`), 2600); }
    else if (r.ok) setErr("The factory refused the launch (symbol taken or rules out of bounds). Your deposit was refunded.");
    else if (!("cancelled" in r && r.cancelled)) setErr(r.message);
  }

  return (
    <div className="mx-auto max-w-7xl px-5 pt-14">
      <Eyebrow>launch · {FACTORY}</Eyebrow>
      <h1 className="mt-3 font-display text-6xl font-extrabold tracking-[-0.05em] md:text-7xl">Arm a new token.</h1>
      <p className="mt-4 max-w-2xl text-lg text-paper/75">Choose the rules your holders get. After launch, nobody can change them, including you. The token gets its own keyless account on NEAR.</p>

      <div className="mt-12 grid gap-8 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-8">
          <fieldset className="rounded-3xl border border-line bg-ink-2 p-6">
            <legend className="px-2 font-mono text-[11px] uppercase tracking-[0.2em] text-mute">identity</legend>
            <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
              <label className="block"><span className="text-sm text-mute">Name</span>
                <input value={name} onChange={(e) => setName(e.target.value.slice(0, 32))} placeholder="Grug Who Cannot Rug" className="mt-1 w-full rounded-xl border border-line bg-ink px-4 py-3 text-lg outline-none transition focus:border-armed" /></label>
              <label className="block"><span className="text-sm text-mute">Symbol</span>
                <div className="relative"><span className="absolute left-4 top-1/2 mt-0.5 -translate-y-1/2 font-mono text-mute">$</span>
                  <input value={sym} onChange={(e) => setSymbol(e.target.value)} placeholder="GRUG" className="mt-1 w-full rounded-xl border border-line bg-ink py-3 pl-8 pr-4 font-mono text-lg uppercase outline-none transition focus:border-armed" /></div>
                <span className={`mt-1 block font-mono text-[11px] ${taken ? "text-trip" : taken === false ? "text-armed" : "text-mute"}`}>{sym.length < 2 ? "2–10 chars" : taken ? "taken" : taken === false ? `${tokenAccount(sym)} is free` : "checking…"}</span></label>
            </div>
            <label className="mt-4 block"><span className="text-sm text-mute">Tagline <span className="font-mono text-[11px]">{tagline.length}/140</span></span>
              <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="grug make coin. grug try rug. contract say no." className="mt-1 w-full rounded-xl border border-line bg-ink px-4 py-3 outline-none transition focus:border-armed" /></label>
            <div className="mt-4"><span className="text-sm text-mute">Fixed supply</span>
              <div className="mt-2 flex flex-wrap gap-2">{SUPPLIES.map((s) => (
                <button key={s} onClick={() => setSupply(s)} className={`rounded-full border px-4 py-2 font-mono text-sm transition ${supply === s ? "border-armed bg-armed text-ink" : "border-line hover:border-paper/40"}`}>{compact(s)}</button>
              ))}</div></div>
          </fieldset>

          <fieldset className="rounded-3xl border border-line bg-ink-2 p-6">
            <legend className="px-2 font-mono text-[11px] uppercase tracking-[0.2em] text-mute">rules · enforced on-chain</legend>
            <div className="flex flex-wrap gap-2">{[...Object.keys(PRESETS), "Custom"].map((p) => (
              <button key={p} disabled={p === "Custom"} onClick={() => { setPreset(p); setRules(PRESETS[p]); }} className={`relative rounded-full px-4 py-2 font-mono text-xs uppercase tracking-[0.14em] transition ${preset === p ? "text-ink" : "text-mute hover:text-paper"}`}>
                {preset === p && <motion.span layoutId="preset" className="absolute inset-0 rounded-full bg-armed" />}<span className="relative">{p}</span></button>
            ))}</div>
            <div className="mt-6 space-y-6">
              {SLIDERS.map((s) => {
                const v = rules[s.k];
                const disabled = s.k === "creator_vest_days" && rules.creator_alloc_bps === 0;
                return (
                  <div key={s.k} className={disabled ? "opacity-40" : ""}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold">{s.label} <span className="ml-1 font-mono text-[10px] text-armed/70">{s.code}</span></span>
                      <motion.span key={v} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="num font-mono text-lg text-armed">{s.fmt(v)}</motion.span>
                    </div>
                    <input type="range" disabled={disabled} min={s.min} max={s.max} step={s.step} value={v} onChange={(e) => set(s.k, Number(e.target.value))} className="mt-2 w-full" />
                    <p className="text-xs text-mute">{s.hint} {s.k !== "creator_vest_days" && s.k !== "sell_cooldown_sec" && s.k !== "fee_bps" ? `≈ ${compact((supply * v) / 10000)} tokens` : ""}</p>
                  </div>
                );
              })}
            </div>
            <p className="mt-6 rounded-xl border border-line bg-ink px-4 py-3 font-mono text-[11px] leading-relaxed text-mute">Hard limits checked by the contract: fee ≤ 5% · max buy/sell 0.1–5% · max wallet 0.5–20% · allocation ≤ 10% with 1–365 days vesting · supply fixed forever.</p>
          </fieldset>
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <motion.div layout className="overflow-hidden rounded-3xl border border-line bg-ink-2">
            <div className="hazard-armed h-1.5 opacity-50" />
            <div className="p-6">
              <Eyebrow>preview</Eyebrow>
              <div className="mt-4 flex items-center gap-4">
                <motion.div key={sym} initial={{ rotate: -20, scale: 0.6, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 300, damping: 18 }}><TokenIcon symbol={sym || "?"} size={72} /></motion.div>
                <div className="min-w-0"><p className="truncate font-display text-3xl font-bold">{name || "Unnamed"}</p><p className="font-mono text-sm text-mute">${sym || "SYMBOL"} · {compact(supply)} supply</p></div>
              </div>
              <p className="mt-4 min-h-6 text-paper/70">{tagline}</p>
              <ul className="mt-5 grid grid-cols-2 gap-2 font-mono text-[11px]">
                {[
                  ["max buy", pct(rules.max_buy_bps)], ["max sell", pct(rules.max_sell_bps)], ["max wallet", pct(rules.max_wallet_bps)], ["fee (↓ only)", pct(rules.fee_bps)],
                  ["cooldown", rules.sell_cooldown_sec ? `${rules.sell_cooldown_sec}s` : "off"], ["dev bag", rules.creator_alloc_bps ? `${pct(rules.creator_alloc_bps)} / ${rules.creator_vest_days}d` : "none"],
                  ["mint", "impossible"], ["liquidity", "locked in code"],
                ].map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between rounded-lg border border-line bg-ink px-3 py-2"><span className="text-mute">{k}</span><span className="text-paper">{v}</span></li>
                ))}
              </ul>
              <div className="mt-6 space-y-1 font-mono text-[11px] text-mute">
                <p>token account → <span className="text-paper">{sym ? tokenAccount(sym) : "sym." + FACTORY}</span></p>
                <p>access keys after launch → <span className="text-armed">0</span></p>
                <p>cost → <span className="text-paper">0.3 testnet NEAR</span> (storage, moves to the token account) + gas</p>
              </div>
              <AnimatePresence>{problems.length > 0 && name + sym !== "" && (
                <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 space-y-1 text-sm text-warn">{problems.map((p) => <li key={p}>• {p}</li>)}</motion.ul>
              )}</AnimatePresence>
              {err && <p className="mt-4 rounded-xl border border-trip/50 bg-trip/10 px-4 py-3 text-sm text-trip">{err}</p>}
              <button onClick={launch} disabled={busy || (!!accountId && problems.length > 0)} className="group mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-armed py-4 font-mono text-sm font-bold uppercase tracking-[0.16em] text-ink transition enabled:hover:-translate-y-0.5 disabled:opacity-40">
                <Mark size={20} color="var(--color-ink)" interactive={false} />{!accountId ? "Connect wallet to launch" : busy ? "Waiting for wallet…" : "Arm & launch"}
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      <AnimatePresence>{done && (
        <motion.div className="fixed inset-0 z-[70] grid place-items-center bg-ink/80 backdrop-blur" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 20 }} className="text-center">
            <motion.div initial={{ rotate: -90 }} animate={{ rotate: 0 }} transition={{ type: "spring", stiffness: 120, damping: 10 }} className="mx-auto w-fit"><Mark size={120} /></motion.div>
            <p className="mt-6 font-display text-6xl font-extrabold tracking-[-0.05em]">${done.symbol} is <span className="text-armed">armed</span>.</p>
            <p className="mt-2 font-mono text-sm text-mute">{tokenAccount(done.symbol)} · 0 access keys · rules final</p>
            {done.hash && <a href={explorerTx(done.hash)} target="_blank" rel="noreferrer" className="mt-4 inline-block font-mono text-xs text-armed underline">launch tx ↗</a>}
          </motion.div>
        </motion.div>
      )}</AnimatePresence>
    </div>
  );
}
