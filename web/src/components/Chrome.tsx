"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Wordmark, Mark } from "./Logo";
import { useWallet } from "./wallet";
import { short } from "@/lib/format";
import { FACTORY, REPO, explorerAcct } from "@/lib/config";

const LINKS = [
  { href: "/", label: "Tokens" },
  { href: "/launch", label: "Launch" },
  { href: "/t/GRUG", label: "Rug lab" },
  { href: "/about", label: "About" },
];

const WALLET_NOTE: Record<string, string> = {
  "intear-wallet": "web wallet · testnet ready · tested",
  "meteor-wallet": "web + extension",
  "hot-wallet": "telegram / extension",
  sender: "extension",
};

export function Nav() {
  const path = usePathname();
  const { accountId, setOpen, disconnect, ready } = useWallet();
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-ink/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5">
        <Link href="/" className="text-xl"><Wordmark /></Link>
        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => {
            const on = l.href === "/" ? path === "/" : path.startsWith(l.href);
            return (
              <Link key={l.href} href={l.href} className="relative px-3 py-2 font-mono text-xs uppercase tracking-[0.16em] text-mute transition hover:text-paper">
                {on && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-ink-3" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
                <span className={`relative ${on ? "text-paper" : ""}`}>{l.label}</span>
              </Link>
            );
          })}
        </nav>
        {accountId ? (
          <button onClick={disconnect} className="group flex items-center gap-2 rounded-full border border-line px-3 py-1.5 font-mono text-xs hover:border-trip" title="Disconnect">
            <span className="pulse-dot h-2 w-2 rounded-full bg-armed" />
            <span className="group-hover:hidden">{short(accountId, 22)}</span>
            <span className="hidden text-trip group-hover:inline">disconnect</span>
          </button>
        ) : (
          <button disabled={!ready} onClick={() => setOpen(true)} className="rounded-full bg-armed px-4 py-2 font-mono text-xs font-bold uppercase tracking-[0.14em] text-ink transition hover:-translate-y-0.5 hover:shadow-[0_6px_0_0_rgba(212,255,58,.25)] disabled:opacity-50">
            {ready ? "Connect wallet" : "Loading…"}
          </button>
        )}
      </div>
      <div className="flex justify-center gap-1 border-t border-line/50 py-1 md:hidden">
        {LINKS.map((l) => <Link key={l.href} href={l.href} className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-mute">{l.label}</Link>)}
      </div>
    </header>
  );
}

export function ConnectModal() {
  const { open, setOpen, modules, connect } = useWallet();
  const list = modules.filter((m) => m.type !== "hardware");
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4 backdrop-blur" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
          <motion.div onClick={(e) => e.stopPropagation()} initial={{ y: 30, scale: 0.96, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 20, opacity: 0 }} transition={{ type: "spring", stiffness: 320, damping: 28 }} className="w-full max-w-md overflow-hidden rounded-3xl border border-line bg-ink-2">
            <div className="hazard-armed h-1.5 opacity-60" />
            <div className="p-6">
              <div className="flex items-center gap-3"><Mark size={36} /><div><h2 className="font-display text-2xl font-bold">Connect a NEAR wallet</h2><p className="text-sm text-mute">Testnet only. Get free test NEAR from the faucet.</p></div></div>
              <ul className="mt-5 space-y-2">
                {list.map((m, i) => (
                  <motion.li key={m.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.04 * i }}>
                    <button onClick={() => connect(m.id).catch((e) => alert(e?.message ?? e))} className="group flex w-full items-center gap-3 rounded-2xl border border-line bg-ink-3/50 px-4 py-3 text-left transition hover:border-armed hover:bg-ink-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={m.metadata.iconUrl} alt="" className="h-8 w-8 rounded-lg" />
                      <span className="flex-1"><span className="block font-semibold">{m.metadata.name}</span><span className="block font-mono text-[11px] text-mute">{WALLET_NOTE[m.id] ?? m.type}{m.metadata.available === false ? " · not detected" : ""}</span></span>
                      <span className="font-mono text-xs text-mute transition group-hover:translate-x-1 group-hover:text-armed">→</span>
                    </button>
                  </motion.li>
                ))}
              </ul>
              <p className="mt-5 text-xs text-mute">No testnet account? Create one in <a className="underline hover:text-armed" href="https://wallet.intear.tech" target="_blank" rel="noreferrer">Intear Wallet</a> (testnet), then fund it from the <a className="underline hover:text-armed" href="https://near-faucet.io" target="_blank" rel="noreferrer">faucet</a>.</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Footer() {
  return (
    <footer className="mt-32 border-t border-line">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Wordmark className="text-2xl" />
          <p className="mt-3 max-w-sm text-sm text-mute">Meme tokens whose rules live in the contract, not in the roadmap. Built on NEAR testnet.</p>
        </div>
        <div className="space-y-2 font-mono text-xs uppercase tracking-[0.14em] text-mute">
          <p className="text-paper">Product</p>
          <Link href="/launch" className="block hover:text-armed">Launch a token</Link>
          <Link href="/t/GRUG" className="block hover:text-armed">Rug lab</Link>
          <Link href="/about" className="block hover:text-armed">About & docs</Link>
        </div>
        <div className="space-y-2 font-mono text-xs uppercase tracking-[0.14em] text-mute">
          <p className="text-paper">On-chain</p>
          <a href={explorerAcct(FACTORY)} target="_blank" rel="noreferrer" className="block hover:text-armed">{FACTORY} ↗</a>
          <a href={REPO} target="_blank" rel="noreferrer" className="block hover:text-armed">GitHub ↗</a>
          <span className="block">MIT licensed · testnet only</span>
        </div>
      </div>
    </footer>
  );
}
