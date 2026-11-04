"use client";
import { use, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { useWallet } from "@/components/wallet";
import { PluckWire } from "@/components/PluckWire";
import { Counter, Eyebrow, TokenIcon } from "@/components/bits";
import { RuleBoard } from "@/components/token/RuleBoard";
import { TradePanel } from "@/components/token/TradePanel";
import { RugLab } from "@/components/token/RugLab";
import { Feed } from "@/components/token/Feed";
import { accessKeys, view, viewAccount } from "@/lib/near";
import { explorerAcct, tokenAccount } from "@/lib/config";
import { compact, fmtNear, near, pricePerMillion, short, tokens } from "@/lib/format";
import type { ChainEvent, Info, Trip, WalletStatus } from "@/lib/types";

export default function TokenPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = use(params);
  const symbol = raw.toUpperCase();
  const account = tokenAccount(symbol);
  const { accountId } = useWallet();
  const [info, setInfo] = useState<Info | null>(null);
  const [missing, setMissing] = useState(false);
  const [events, setEvents] = useState<ChainEvent[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [keys, setKeys] = useState<number | null>(null);
  const [globalHash, setGlobalHash] = useState<string | null>(null);
  const [status, setStatus] = useState<WalletStatus | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [pluck, setPluck] = useState(0);
  const seen = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    try {
      const [i, e] = await Promise.all([view<Info>(account, "tripwire_info"), view<ChainEvent[]>(account, "events", { limit: 64 })]);
      setInfo(i); setEvents(e);
    } catch { setMissing(true); }
    fetch(`/api/trips?account=${account}`).then((r) => r.json()).then((j: { trips?: Trip[] }) => {
      const t = j.trips ?? [];
      if (seen.current) {
        const fresh = t.find((x) => !seen.current!.has(x.hash));
        if (fresh) { setFlash(fresh.rule); setPluck((p) => p + 1); setTimeout(() => setFlash(null), 2600); }
      }
      seen.current = new Set(t.map((x) => x.hash));
      setTrips(t);
    }).catch(() => {});
  }, [account]);

  useEffect(() => {
    load();
    accessKeys(account).then((k) => setKeys(k.length)).catch(() => {});
    viewAccount(account).then((a) => setGlobalHash(a.global_contract_hash ?? null)).catch(() => {});
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [account, load]);

  useEffect(() => {
    if (!accountId) return setStatus(null);
    const f = () => view<WalletStatus>(account, "wallet_status", { account_id: accountId }).then(setStatus).catch(() => {});
    f(); const t = setInterval(f, 5000);
    return () => clearInterval(t);
  }, [accountId, account, events.length]);

  if (missing && !info) return (
    <div className="mx-auto max-w-3xl px-5 py-32 text-center">
      <p className="font-display text-6xl font-bold">${symbol} isn&apos;t armed yet.</p>
      <p className="mt-3 text-mute">No Tripwire token lives at {account}.</p>
      <Link href="/launch" className="mt-8 inline-block rounded-full bg-armed px-6 py-3 font-mono text-sm font-bold uppercase tracking-[0.14em] text-ink">Launch it</Link>
    </div>
  );
  if (!info) return <div className="mx-auto max-w-7xl px-5 py-20"><div className="h-40 animate-pulse rounded-3xl bg-ink-2" /><div className="mt-6 h-96 animate-pulse rounded-3xl bg-ink-2" /></div>;

  const curveSupply = tokens(info.total_supply) - tokens(info.creator_alloc);
  const sold = 1 - tokens(info.curve_tokens) / curveSupply;
  const mcap = pricePerMillion(info.price_yocto_per_token) * tokens(info.total_supply) / 1e6;
  return (
    <div>
      <section className="gridlines border-b border-line">
        <div className="mx-auto max-w-7xl px-5 pt-12">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:flex-wrap sm:items-center">
            <motion.div initial={{ scale: 0.5, rotate: -30, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 200, damping: 14 }}><TokenIcon symbol={symbol} icon={info.icon} size={88} /></motion.div>
            <div className="min-w-0 flex-1">
              <Eyebrow>${info.symbol} · <a href={explorerAcct(account)} target="_blank" rel="noreferrer" className="hover:text-paper">{account} ↗</a></Eyebrow>
              <h1 className="mt-1 font-display text-5xl font-extrabold tracking-[-0.05em] md:text-6xl">{info.name}</h1>
              <p className="mt-1 text-paper/70">{info.tagline}</p>
            </div>
            <div className="rounded-2xl border border-line bg-ink-2 px-4 py-3 font-mono text-[11px]">
              <p className="text-mute">creator</p><a href={explorerAcct(info.creator)} target="_blank" rel="noreferrer" className="text-paper hover:underline">{short(info.creator, 26)}</a>
              <p className="mt-1 text-mute">access keys on token account</p><p className={keys === 0 ? "text-armed" : "text-warn"}>{keys === null ? "checking…" : keys === 0 ? "0 · nobody can redeploy" : `${keys}`}</p>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-t-2xl border border-b-0 border-line bg-line md:grid-cols-6">
            {[
              { k: "price / 1M", v: pricePerMillion(info.price_yocto_per_token), d: 4, u: "Ⓝ" },
              { k: "market cap", v: mcap, d: 1, u: "Ⓝ" },
              { k: "curve liquidity", v: near(info.curve_near), d: 3, u: "Ⓝ" },
              { k: "volume", v: near(info.volume_near), d: 3, u: "Ⓝ" },
              { k: "holders · trades", v: info.holders, d: 0, u: `· ${info.trades}` },
              { k: "rugs blocked", v: trips.length, d: 0, u: "", hot: true },
            ].map((s) => (
              <div key={s.k} className="bg-ink px-4 py-4">
                <p className={`font-display text-2xl font-bold ${s.hot ? "text-trip" : ""}`}><Counter value={s.v} decimals={s.d} /> <span className="font-mono text-sm text-mute">{s.u}</span></p>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute">{s.k}</p>
              </div>
            ))}
          </div>
        </div>
        <PluckWire height={110} trip={pluck} label={`${(sold * 100).toFixed(2)}% of curve sold · ${compact(tokens(info.curve_tokens))} left`} />
      </section>

      <div className="mx-auto mt-10 grid max-w-7xl gap-6 px-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <div>
            <div className="mb-3 flex items-end justify-between"><h2 className="font-display text-3xl font-bold tracking-[-0.03em]">Rules, live</h2><p className="font-mono text-[11px] text-mute">read from {account}</p></div>
            <RuleBoard info={info} trips={trips} keys={keys} account={account} globalHash={globalHash} flash={flash} />
          </div>
        </div>
        <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
          <TradePanel info={info} account={account} status={status} onDone={load} />
          <div className="rounded-3xl border border-line bg-ink-2 p-5 font-mono text-[11px] text-mute">
            <p>creator fees earned: <span className="text-paper">{fmtNear(info.creator_fees_total)} Ⓝ</span></p>
            <p>curve depth: <span className="text-paper">{fmtNear(info.virtual_near, 0)} Ⓝ virtual</span> + real NEAR from buys</p>
            <p>launched: <span className="text-paper">{new Date(info.launched_at_ms).toLocaleString()}</span></p>
          </div>
        </div>
      </div>
      <div className="mx-auto mt-6 max-w-7xl space-y-6 px-5">
        <RugLab info={info} account={account} status={status} onDone={load} />
        <Feed events={events} trips={trips} symbol={info.symbol} />
      </div>
    </div>
  );
}
