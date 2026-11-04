const TEN18 = 10n ** 18n;
const TEN24 = 10n ** 24n;
export const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 === 0 ? 0 : bps % 10 === 0 ? 1 : 2)}%`;
export function compact(n: number) {
  if (n >= 1e12) return (n / 1e12).toFixed(2).replace(/\.00$/, "") + "T";
  if (n >= 1e9) return (n / 1e9).toFixed(2).replace(/\.00$/, "") + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2).replace(/\.00$/, "") + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
export const tokens = (raw: string | bigint) => Number(BigInt(raw) / TEN18) + Number(BigInt(raw) % TEN18) / 1e18;
export const near = (yocto: string | bigint) => Number(BigInt(yocto) / 10n ** 18n) / 1e6;
export const fmtNear = (yocto: string | bigint, d = 4) => near(yocto).toLocaleString("en-US", { maximumFractionDigits: d });
export const toYocto = (n: number | string) => {
  const [w, f = ""] = String(n).split(".");
  return (BigInt(w || "0") * TEN24 + BigInt((f + "0".repeat(24)).slice(0, 24))).toString();
};
export const toRawTokens = (n: number | string) => {
  const [w, f = ""] = String(n).split(".");
  return (BigInt(w || "0") * TEN18 + BigInt((f + "0".repeat(18)).slice(0, 18))).toString();
};
export const short = (a: string, n = 18) => (a.length > n ? a.slice(0, n - 6) + "…" + a.slice(-5) : a);
export function ago(ms: number) {
  const s = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
/** Price in NEAR per 1M tokens, which reads better for meme supplies. */
export const pricePerMillion = (yoctoPerToken: string) => near(BigInt(yoctoPerToken) * 1_000_000n);
