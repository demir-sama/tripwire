/** Deterministic token mark: a wire stretched across a badge, snagged at a point
 * derived from the symbol. Small enough to store on-chain as ft_metadata.icon. */
function hash(s: string) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
const PALETTES = [
  ["#D4FF3A", "#0B0B0C"], ["#FF5B2E", "#0B0B0C"], ["#7C5CFF", "#F2EFE6"], ["#3AF2C5", "#0B0B0C"],
  ["#FFD23A", "#0B0B0C"], ["#FF3D9A", "#0B0B0C"], ["#4DA3FF", "#0B0B0C"], ["#F2EFE6", "#0B0B0C"],
];
export function glyphSvg(symbol: string) {
  const h = hash(symbol || "?");
  const [bg, fg] = PALETTES[h % PALETTES.length];
  const x = 22 + (h >> 3) % 20;
  const dip = 8 + (h >> 7) % 14;
  const shape = (h >> 11) % 3;
  const t = (symbol || "?").slice(0, 4);
  const fs = t.length <= 2 ? 22 : t.length === 3 ? 17 : 13;
  const frame = shape === 0 ? `<rect x="2" y="2" width="60" height="60" rx="14" fill="${bg}"/>` : shape === 1 ? `<circle cx="32" cy="32" r="30" fill="${bg}"/>` : `<path d="M32 2 L62 32 L32 62 L2 32Z" fill="${bg}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${frame}<path d="M6 20 L${x} ${20 + dip} L58 20" fill="none" stroke="${fg}" stroke-width="3" stroke-linejoin="round"/><circle cx="${x}" cy="${20 + dip}" r="3.5" fill="${fg}"/><text x="32" y="${shape === 2 ? 46 : 50}" text-anchor="middle" font-family="monospace" font-weight="700" font-size="${fs}" fill="${fg}">${t}</text></svg>`;
}
export const glyphDataUrl = (symbol: string) => `data:image/svg+xml;base64,${typeof window === "undefined" ? Buffer.from(glyphSvg(symbol)).toString("base64") : btoa(glyphSvg(symbol))}`;
