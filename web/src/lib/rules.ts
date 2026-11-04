import type { Info } from "./types";
import { pct, compact, tokens } from "./format";

export type RuleCode =
  | "MAX_BUY" | "MAX_SELL" | "MAX_WALLET" | "FEE_RATCHET" | "FIXED_SUPPLY"
  | "LIQUIDITY_LOCK" | "VESTING_LOCK" | "SELL_COOLDOWN" | "IMMUTABLE_RULES" | "IMMUTABLE_CODE";

export const RULES: { code: RuleCode; n: string; title: string; promise: string; enforced: string }[] = [
  { code: "FIXED_SUPPLY", n: "01", title: "Fixed supply", promise: "“We will never mint more.”", enforced: "There is no mint authority. `mint` exists only to panic." },
  { code: "LIQUIDITY_LOCK", n: "02", title: "Liquidity lock", promise: "“LP is locked, trust me.”", enforced: "Curve NEAR has no withdraw path. It leaves only through sells, priced by the curve." },
  { code: "VESTING_LOCK", n: "03", title: "Creator vesting", promise: "“Team tokens are vested.”", enforced: "The creator allocation unlocks linearly. Selling or sending locked tokens panics." },
  { code: "MAX_SELL", n: "04", title: "Max sell per tx", promise: "“Dev won't dump.”", enforced: "Every sell is capped at a share of supply, for every wallet including the creator." },
  { code: "MAX_BUY", n: "05", title: "Max buy per tx", promise: "“Fair launch.”", enforced: "No single transaction can sweep the curve." },
  { code: "MAX_WALLET", n: "06", title: "Max wallet", promise: "“No whales.”", enforced: "A buy or transfer that would push a wallet over the cap panics." },
  { code: "FEE_RATCHET", n: "07", title: "Fee ratchet", promise: "“Fees stay low.”", enforced: "The creator fee is capped at launch and can only go down." },
  { code: "SELL_COOLDOWN", n: "08", title: "Sell cooldown", promise: "“No bot dumps.”", enforced: "Each wallet waits between sells. Back-to-back dumps panic." },
  { code: "IMMUTABLE_RULES", n: "09", title: "Rules can't be rewritten", promise: "“We won't change the rules.”", enforced: "No setter exists. The creator role can't be handed off." },
  { code: "IMMUTABLE_CODE", n: "10", title: "Keyless account", promise: "“Contract is renounced.”", enforced: "Token accounts are born with zero access keys. Nobody can redeploy the code." },
];

export function ruleValue(code: RuleCode, i: Info): string {
  const r = i.rules;
  switch (code) {
    case "FIXED_SUPPLY": return `${compact(tokens(i.total_supply))} forever`;
    case "LIQUIDITY_LOCK": return "no withdraw path";
    case "VESTING_LOCK": return r.creator_alloc_bps ? `${pct(r.creator_alloc_bps)} over ${r.creator_vest_days}d` : "no allocation";
    case "MAX_SELL": return `${pct(r.max_sell_bps)} · ${compact(tokens(i.max_sell_tokens))}`;
    case "MAX_BUY": return `${pct(r.max_buy_bps)} · ${compact(tokens(i.max_buy_tokens))}`;
    case "MAX_WALLET": return `${pct(r.max_wallet_bps)} · ${compact(tokens(i.max_wallet_tokens))}`;
    case "FEE_RATCHET": return `${pct(r.fee_bps)} ↓ only`;
    case "SELL_COOLDOWN": return r.sell_cooldown_sec ? `${r.sell_cooldown_sec}s` : "off";
    case "IMMUTABLE_RULES": return "no setter";
    case "IMMUTABLE_CODE": return "0 keys";
  }
}

export function parseTrip(text: string): { rule: string; message: string } | null {
  const m = text.match(/TRIPWIRE\[([A-Z_]+)\]\s*([^"\\]*)/);
  if (m) return { rule: m[1], message: m[2].trim() };
  const e = text.match(/ERR\[([A-Z_]+)\]\s*([^"\\]*)/);
  if (e) return { rule: `ERR_${e[1]}`, message: e[2].trim() };
  return null;
}
