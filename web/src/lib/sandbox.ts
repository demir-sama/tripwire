/** Scripted rug attempts a visitor can fire without a wallet. A sandbox creator
 * account (tripwire-ops.testnet) signs each one as a real testnet transaction
 * against its own token, GRUG. Every one of them is meant to fail. */
export type SandboxAction = { id: string; label: string; verb: string; method: string; args: Record<string, unknown>; depositNear?: string; expect: string; story: string };
const M = (n: number) => (BigInt(n) * 10n ** 18n).toString();
export const SANDBOX_ACTIONS: SandboxAction[] = [
  { id: "dump", label: "Dump the dev bag", verb: "sell 4M GRUG from the vesting allocation", method: "sell", args: { amount: M(4_000_000) }, depositNear: "0.000000000000000000000001", expect: "VESTING_LOCK", story: "The creator tries to cash out their allocation on day one." },
  { id: "megadump", label: "Market-sell 40M", verb: "sell 40M GRUG in one transaction", method: "sell", args: { amount: M(40_000_000) }, depositNear: "0.000000000000000000000001", expect: "MAX_SELL", story: "One giant sell to nuke the chart." },
  { id: "mint", label: "Print a billion more", verb: "mint 1B GRUG", method: "mint", args: { amount: M(1_000_000_000) }, expect: "FIXED_SUPPLY", story: "Inflate supply and sell into holders." },
  { id: "fee", label: "Crank the fee to 5%", verb: "set_fee(500)", method: "set_fee", args: { fee_bps: 500 }, expect: "FEE_RATCHET", story: "Quietly raise the tax once people are in." },
  { id: "drain", label: "Pull the liquidity", verb: "withdraw_liquidity()", method: "withdraw_liquidity", args: {}, expect: "LIQUIDITY_LOCK", story: "The classic: take the pool and run." },
  { id: "rules", label: "Rewrite the rules", verb: "set_rules(no limits)", method: "set_rules", args: { rules: null }, expect: "IMMUTABLE_RULES", story: "Turn every limit off after launch." },
  { id: "handoff", label: "Hand off to a burner", verb: "transfer_ownership(burner)", method: "transfer_ownership", args: { new_owner: "burner-wallet.testnet" }, expect: "IMMUTABLE_RULES", story: "Move control to a fresh wallet, then act." },
  { id: "upgrade", label: "Swap the contract", verb: "upgrade()", method: "upgrade", args: {}, expect: "IMMUTABLE_CODE", story: "Deploy new code with a backdoor." },
  { id: "whale", label: "Snipe the curve", verb: "buy with 2 NEAR", method: "buy", args: {}, depositNear: "2", expect: "MAX_BUY", story: "Sweep a huge share of supply in one buy." },
];
