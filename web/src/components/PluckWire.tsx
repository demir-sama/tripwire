"use client";
import { useEffect, useRef } from "react";

/** A taut wire you can pluck with the cursor. `trip` (a counter) snaps it red. */
export function PluckWire({ height = 220, trip = 0, className = "", label }: { height?: number; trip?: number; className?: string; label?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const tripRef = useRef({ n: trip, heat: 0 });
  const api = useRef<{ snap: () => void }>({ snap: () => {} });

  useEffect(() => {
    if (trip !== tripRef.current.n) { tripRef.current.n = trip; api.current.snap(); }
  }, [trip]);

  useEffect(() => {
    const cv = ref.current!;
    const ctx = cv.getContext("2d")!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const N = 90;
    let W = 0, H = 0, dpr = 1;
    const y = new Float32Array(N), v = new Float32Array(N);
    let mouse = { x: -1, y: -1, in: false };
    let grabbed = -1;
    let raf = 0;
    const sparks: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = W * dpr; cv.height = H * dpr;
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(cv);
    const mid = () => H / 2;
    const px = (i: number) => (i / (N - 1)) * W;
    const onMove = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      mouse = { x: e.clientX - r.left, y: e.clientY - r.top, in: true };
    };
    const onLeave = () => { mouse.in = false; };
    window.addEventListener("pointermove", onMove, { passive: true });
    cv.addEventListener("pointerleave", onLeave);
    api.current.snap = () => {
      tripRef.current.heat = 1;
      const c = Math.floor(N * (0.3 + Math.random() * 0.4));
      for (let i = 1; i < N - 1; i++) v[i] += Math.exp(-((i - c) ** 2) / 60) * 26 * (Math.random() > 0.5 ? 1 : -1);
      for (let k = 0; k < 26; k++) sparks.push({ x: px(c), y: mid() + y[c], vx: (Math.random() - 0.5) * 9, vy: (Math.random() - 0.9) * 8, life: 1 });
    };
    // idle shimmer so the wire never looks dead
    let t = 0;
    const step = () => {
      t += 1;
      const m = mid();
      // grab / release
      if (mouse.in && mouse.x >= 0 && mouse.x <= W) {
        const i = Math.round((mouse.x / W) * (N - 1));
        const dy = mouse.y - m;
        if (grabbed === -1 && Math.abs(dy - y[i]) < 14) grabbed = i;
        if (grabbed !== -1) {
          if (Math.abs(dy) > H * 0.38) {
            grabbed = -1; // released: twang
          } else {
            const g = grabbed = i;
            for (let j = 1; j < N - 1; j++) {
              const f = Math.max(0, 1 - Math.abs(j - g) / (N * 0.45));
              y[j] += (dy * f - y[j]) * 0.35;
              v[j] *= 0.5;
            }
          }
        }
      } else grabbed = -1;
      if (grabbed === -1) {
        for (let s = 0; s < 2; s++) {
          for (let j = 1; j < N - 1; j++) v[j] += (y[j - 1] + y[j + 1] - 2 * y[j]) * 0.42;
          for (let j = 1; j < N - 1; j++) { v[j] *= 0.992; y[j] += v[j] * 0.5; }
        }
        if (!reduce && t % 240 === 0) v[Math.floor(N * (0.2 + Math.random() * 0.6))] += 2.2;
      }
      // draw
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const heat = tripRef.current.heat;
      tripRef.current.heat = Math.max(0, heat - 0.006);
      const col = heat > 0.02 ? `rgba(255,${Math.round(59 + (1 - heat) * 196)},${Math.round(31 + (1 - heat) * 27)},1)` : "#d4ff3a";
      ctx.lineWidth = 2.2; ctx.strokeStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(0, m + y[0]);
      for (let j = 1; j < N; j++) {
        const xc = (px(j - 1) + px(j)) / 2, yc = m + (y[j - 1] + y[j]) / 2;
        ctx.quadraticCurveTo(px(j - 1), m + y[j - 1], xc, yc);
      }
      ctx.lineTo(W, m + y[N - 1]);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = col;
      for (const ex of [6, W - 6]) { ctx.beginPath(); ctx.arc(ex, m, 5, 0, Math.PI * 2); ctx.fill(); }
      for (let k = sparks.length - 1; k >= 0; k--) {
        const s = sparks[k]; s.x += s.vx; s.y += s.vy; s.vy += 0.35; s.life -= 0.025;
        if (s.life <= 0) { sparks.splice(k, 1); continue; }
        ctx.globalAlpha = s.life; ctx.fillStyle = "#ff3b1f"; ctx.fillRect(s.x, s.y, 3, 3);
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("pointermove", onMove); cv.removeEventListener("pointerleave", onLeave); };
  }, []);

  return (
    <div className={`relative ${className}`} style={{ height }}>
      <canvas ref={ref} className="absolute inset-0 h-full w-full cursor-grab touch-none" aria-hidden />
      {label && <span className="pointer-events-none absolute right-3 top-3 font-mono text-[10px] uppercase tracking-[0.2em] text-mute">{label}</span>}
    </div>
  );
}
