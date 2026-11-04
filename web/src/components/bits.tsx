"use client";
import { animate, motion, useInView, useMotionValue, useTransform } from "motion/react";
import { useEffect, useRef, type ReactNode } from "react";
import { glyphDataUrl } from "@/lib/glyph";

export function Counter({ value, decimals = 0, className = "" }: { value: number; decimals?: number; className?: string }) {
  const mv = useMotionValue(0);
  const txt = useTransform(mv, (v) => v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  useEffect(() => { if (inView) { const c = animate(mv, value, { duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }); return c.stop; } }, [inView, value, mv]);
  return <motion.span ref={ref} className={`num ${className}`}>{txt}</motion.span>;
}

export function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 24, filter: "blur(6px)" }} whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }} viewport={{ once: true, margin: "-60px" }} transition={{ duration: 0.7, delay, ease: [0.2, 0.8, 0.2, 1] }}>
      {children}
    </motion.div>
  );
}

export function SplitWords({ text, className = "", delay = 0 }: { text: string; className?: string; delay?: number }) {
  return (
    <span className={className}>
      {text.split(" ").map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <motion.span className="inline-block" initial={{ y: "110%", rotate: 6 }} animate={{ y: 0, rotate: 0 }} transition={{ duration: 0.8, delay: delay + i * 0.07, ease: [0.2, 0.9, 0.1, 1] }}>
            {w}&nbsp;
          </motion.span>
        </span>
      ))}
    </span>
  );
}

export function TokenIcon({ symbol, icon, size = 48 }: { symbol: string; icon?: string | null; size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={icon || glyphDataUrl(symbol)} alt={symbol} width={size} height={size} style={{ width: size, height: size }} className="shrink-0" />;
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`font-mono text-[11px] uppercase tracking-[0.22em] text-mute ${className}`}>{children}</p>;
}

export function Marquee({ items }: { items: string[] }) {
  const row = [...items, ...items];
  return (
    <div className="relative overflow-hidden border-y border-line bg-ink-2 py-3">
      <div className="marquee flex w-max gap-10 whitespace-nowrap font-mono text-xs uppercase tracking-[0.25em]">
        {row.map((t, i) => <span key={i} className={i % 2 ? "text-mute" : "text-armed"}>✕ {t}</span>)}
      </div>
    </div>
  );
}
