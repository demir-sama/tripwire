"use client";
import { motion, useAnimationControls } from "motion/react";

/** Tripwire mark: a T whose crossbar is a wire pulled taut into a snag. */
export function Mark({ size = 32, color = "var(--color-armed)", tripped = false, interactive = true }: { size?: number; color?: string; tripped?: boolean; interactive?: boolean }) {
  const c = useAnimationControls();
  const twang = () => interactive && c.start({ d: ["M6 18 L32 30 L58 18", "M6 18 L32 12 L58 18", "M6 18 L32 26 L58 18", "M6 18 L32 19 L58 18", "M6 18 L32 30 L58 18"], transition: { duration: 0.7, ease: "easeOut" } });
  const col = tripped ? "var(--color-trip)" : color;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" onMouseEnter={twang} aria-label="Tripwire" role="img">
      <circle cx="6" cy="18" r="4" fill={col} />
      <circle cx="58" cy="18" r="4" fill={col} />
      <motion.path animate={c} initial={{ d: "M6 18 L32 30 L58 18" }} fill="none" stroke={col} strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M32 30 L32 58" stroke={col} strokeWidth="9" strokeLinecap="square" />
      <path d="M32 22 L38 30 L32 38 L26 30Z" fill="var(--color-ink)" stroke={col} strokeWidth="3" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 font-display font-extrabold tracking-[-0.04em] ${className}`}>
      <Mark size={28} />
      <span>TRIP<span className="text-armed">WIRE</span></span>
    </span>
  );
}
