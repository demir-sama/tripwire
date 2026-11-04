export type Rules = {
  max_buy_bps: number;
  max_sell_bps: number;
  max_wallet_bps: number;
  fee_bps: number;
  sell_cooldown_sec: number;
  creator_alloc_bps: number;
  creator_vest_days: number;
};
export type Info = {
  name: string; symbol: string; icon: string | null; tagline: string; creator: string; factory: string;
  decimals: number; total_supply: string; rules: Rules; fee_cap_bps: number; launched_at_ms: number;
  curve_tokens: string; curve_near: string; virtual_near: string; price_yocto_per_token: string;
  creator_alloc: string; creator_locked: string; creator_fees_unclaimed: string; creator_fees_total: string;
  max_buy_tokens: string; max_sell_tokens: string; max_wallet_tokens: string; holders: number; trades: number;
  volume_near: string; event_count: number;
};
export type TokenEntry = { account_id: string; symbol: string; name: string; creator: string; created_at_ms: number };
export type ChainEvent = { id: number; kind: string; actor: string; tokens: string; near: string; ts_ms: number; note: string };
export type WalletStatus = { balance: string; registered: boolean; locked: string; sell_ready_in_sec: number; wallet_room: string };
export type Trip = { hash: string; signer: string; method: string; rule: string; message: string; ts_ms: number };
export type FactoryConfig = { owner: string; token_code_hash: string; min_launch_deposit: string; virtual_near: string; launches: number };
