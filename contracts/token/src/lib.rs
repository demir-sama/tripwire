//! Tripwire token: a NEP-141 meme token with its own bonding-curve pool and
//! rules that are enforced by code, not promised in a tweet.
//!
//! Every rule violation panics with `TRIPWIRE[<RULE>] <reason>` so the whole
//! transaction is rejected on-chain and nothing moves.
//!
//! The account this contract lives on is created by the Tripwire factory with
//! NO access keys, so nobody (not the creator, not the factory) can redeploy it.

use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::store::{LookupMap, Vector};
use near_sdk::{
    env, ext_contract, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise,
    PromiseOrValue, PromiseResult,
};

pub const DECIMALS: u8 = 18;
const ONE_TOKEN: u128 = 1_000_000_000_000_000_000;
const ONE_NEAR: u128 = 1_000_000_000_000_000_000_000_000;
/// Storage cost charged once per holder (covers the balance entry).
pub const STORAGE_DEPOSIT: u128 = 1_250_000_000_000_000_000_000; // 0.00125 NEAR
const EVENT_CAP: u32 = 64;
const BPS: u128 = 10_000;
const GAS_FT_ON_TRANSFER: Gas = Gas::from_tgas(35);
const GAS_RESOLVE: Gas = Gas::from_tgas(10);

/// Hard protocol limits: a launch can choose its rules, but only inside these bounds.
pub mod limits {
    pub const MAX_FEE_BPS: u16 = 500; // 5%
    pub const MIN_TX_BPS: u16 = 10; // 0.1% of supply
    pub const MAX_TX_BPS: u16 = 500; // 5% of supply
    pub const MIN_WALLET_BPS: u16 = 50; // 0.5%
    pub const MAX_WALLET_BPS: u16 = 2_000; // 20%
    pub const MAX_COOLDOWN_SEC: u32 = 86_400;
    pub const MAX_CREATOR_BPS: u16 = 1_000; // 10%
    pub const MAX_VEST_DAYS: u32 = 365;
}

/// The rules a token is launched with. There is no setter for any of them;
/// the creator fee can only ever be lowered (`set_fee`).
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct Rules {
    /// Max tokens bought in one transaction, in basis points of total supply.
    pub max_buy_bps: u16,
    /// Max tokens sold in one transaction, in basis points of total supply.
    pub max_sell_bps: u16,
    /// Max tokens any single wallet may hold after a buy or transfer.
    pub max_wallet_bps: u16,
    /// Creator fee on every buy and sell. Ratchet: can go down, never up.
    pub fee_bps: u16,
    /// Seconds a wallet must wait between two sells.
    pub sell_cooldown_sec: u32,
    /// Creator allocation minted at launch, in basis points of supply.
    pub creator_alloc_bps: u16,
    /// Linear vesting of the creator allocation, in days from launch.
    pub creator_vest_days: u32,
}

impl Rules {
    pub fn validate(&self) {
        use limits::*;
        require!(self.fee_bps <= MAX_FEE_BPS, "ERR[RULES] creator fee above 5% cap");
        require!(
            (MIN_TX_BPS..=MAX_TX_BPS).contains(&self.max_buy_bps),
            "ERR[RULES] max buy must be 0.1%-5% of supply"
        );
        require!(
            (MIN_TX_BPS..=MAX_TX_BPS).contains(&self.max_sell_bps),
            "ERR[RULES] max sell must be 0.1%-5% of supply"
        );
        require!(
            (MIN_WALLET_BPS..=MAX_WALLET_BPS).contains(&self.max_wallet_bps),
            "ERR[RULES] max wallet must be 0.5%-20% of supply"
        );
        require!(self.max_wallet_bps >= self.max_buy_bps, "ERR[RULES] max wallet below max buy");
        require!(self.sell_cooldown_sec <= MAX_COOLDOWN_SEC, "ERR[RULES] cooldown above 24h");
        require!(self.creator_alloc_bps <= MAX_CREATOR_BPS, "ERR[RULES] creator allocation above 10%");
        if self.creator_alloc_bps > 0 {
            require!(
                (1..=MAX_VEST_DAYS).contains(&self.creator_vest_days),
                "ERR[RULES] creator allocation needs 1-365 days of vesting"
            );
        }
    }
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug)]
pub struct Event {
    pub id: u64,
    pub kind: String,
    pub actor: AccountId,
    pub tokens: U128,
    pub near: U128,
    pub ts_ms: u64,
    pub note: String,
}

#[near(serializers = [json])]
pub struct FtMetadata {
    pub spec: String,
    pub name: String,
    pub symbol: String,
    pub icon: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<String>,
    pub decimals: u8,
}

#[near(serializers = [json])]
pub struct StorageBalance {
    pub total: U128,
    pub available: U128,
}

#[near(serializers = [json])]
pub struct StorageBalanceBounds {
    pub min: U128,
    pub max: Option<U128>,
}

#[near(serializers = [json])]
pub struct Info {
    pub name: String,
    pub symbol: String,
    pub icon: Option<String>,
    pub tagline: String,
    pub creator: AccountId,
    pub factory: AccountId,
    pub decimals: u8,
    pub total_supply: U128,
    pub rules: Rules,
    pub fee_cap_bps: u16,
    pub launched_at_ms: u64,
    pub curve_tokens: U128,
    pub curve_near: U128,
    pub virtual_near: U128,
    pub price_yocto_per_token: U128,
    pub creator_alloc: U128,
    pub creator_locked: U128,
    pub creator_fees_unclaimed: U128,
    pub creator_fees_total: U128,
    pub max_buy_tokens: U128,
    pub max_sell_tokens: U128,
    pub max_wallet_tokens: U128,
    pub holders: u32,
    pub trades: u64,
    pub volume_near: U128,
    pub event_count: u64,
}

#[near(serializers = [json])]
pub struct WalletStatus {
    pub balance: U128,
    pub registered: bool,
    pub locked: U128,
    pub sell_ready_in_sec: u32,
    pub wallet_room: U128,
}

#[ext_contract(ext_receiver)]
pub trait FtReceiver {
    fn ft_on_transfer(&mut self, sender_id: AccountId, amount: U128, msg: String) -> PromiseOrValue<U128>;
}

#[ext_contract(ext_self)]
pub trait SelfCb {
    fn ft_resolve_transfer(&mut self, sender_id: AccountId, receiver_id: AccountId, amount: U128) -> U128;
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Token {
    factory: AccountId,
    creator: AccountId,
    name: String,
    symbol: String,
    icon: Option<String>,
    tagline: String,
    total_supply: u128,
    rules: Rules,
    fee_cap_bps: u16,
    launched_at_ns: u64,
    balances: LookupMap<AccountId, u128>,
    last_sell_ns: LookupMap<AccountId, u64>,
    curve_near: u128,
    virtual_near: u128,
    creator_alloc: u128,
    creator_fees: u128,
    creator_fees_total: u128,
    holders: u32,
    trades: u64,
    volume_near: u128,
    events: Vector<Event>,
    event_count: u64,
}

fn trip(rule: &str, why: String) -> ! {
    env::panic_str(&format!("TRIPWIRE[{rule}] {why}"))
}

/// a * b / d with a 256-bit intermediate, so curve math never overflows.
pub fn mul_div(a: u128, b: u128, d: u128) -> u128 {
    require!(d != 0, "ERR[MATH] div by zero");
    let (a1, a0) = (a >> 64, a & u64::MAX as u128);
    let (b1, b0) = (b >> 64, b & u64::MAX as u128);
    let p00 = a0 * b0;
    let p01 = a0 * b1;
    let p10 = a1 * b0;
    let p11 = a1 * b1;
    let mid = (p00 >> 64) + (p01 & u64::MAX as u128) + (p10 & u64::MAX as u128);
    let lo = (p00 & u64::MAX as u128) | (mid << 64);
    let hi = p11 + (p01 >> 64) + (p10 >> 64) + (mid >> 64);
    if hi == 0 {
        return lo / d;
    }
    require!(hi < d, "ERR[MATH] overflow");
    let (mut r, mut q) = (hi, 0u128);
    for i in (0..128).rev() {
        let carry = r >> 127;
        r = (r << 1) | ((lo >> i) & 1);
        q <<= 1;
        if carry == 1 || r >= d {
            r = r.wrapping_sub(d);
            q |= 1;
        }
    }
    q
}

fn fmt_tokens(x: u128) -> String {
    let whole = x / ONE_TOKEN;
    let s = whole.to_string();
    let mut out = String::new();
    for (i, c) in s.chars().enumerate() {
        if i > 0 && (s.len() - i) % 3 == 0 {
            out.push(',');
        }
        out.push(c);
    }
    out
}

fn fmt_near(x: u128) -> String {
    format!("{}.{:04}", x / ONE_NEAR, (x % ONE_NEAR) / (ONE_NEAR / 10_000))
}

fn pct(bps: u16) -> String {
    format!("{}.{:02}%", bps / 100, bps % 100)
}

#[near]
impl Token {
    /// Called once by the factory in the same batch that creates this keyless account.
    #[init]
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        creator: AccountId,
        name: String,
        symbol: String,
        icon: Option<String>,
        tagline: String,
        supply_whole: U128,
        virtual_near: U128,
        rules: Rules,
    ) -> Self {
        rules.validate();
        let supply_whole = supply_whole.0;
        require!(
            (1_000_000..=1_000_000_000_000).contains(&supply_whole),
            "ERR[RULES] supply must be 1M - 1T tokens"
        );
        require!(virtual_near.0 >= ONE_NEAR, "ERR[RULES] virtual liquidity too small");
        require!(!name.is_empty() && name.len() <= 32, "ERR[META] name 1-32 chars");
        require!(tagline.len() <= 140, "ERR[META] tagline max 140 chars");
        if let Some(i) = &icon {
            require!(i.len() <= 4096, "ERR[META] icon max 4KB");
        }
        let total = supply_whole * ONE_TOKEN;
        let creator_alloc = total * rules.creator_alloc_bps as u128 / BPS;
        let me = env::current_account_id();
        let mut t = Self {
            factory: env::predecessor_account_id(),
            creator: creator.clone(),
            name,
            symbol,
            icon,
            tagline,
            total_supply: total,
            fee_cap_bps: rules.fee_bps,
            rules,
            launched_at_ns: env::block_timestamp(),
            balances: LookupMap::new(b"b"),
            last_sell_ns: LookupMap::new(b"s"),
            curve_near: 0,
            virtual_near: virtual_near.0,
            creator_alloc,
            creator_fees: 0,
            creator_fees_total: 0,
            holders: 0,
            trades: 0,
            volume_near: 0,
            events: Vector::new(b"e"),
            event_count: 0,
        };
        t.balances.insert(me.clone(), total - creator_alloc);
        t.balances.insert(creator.clone(), creator_alloc);
        if creator_alloc > 0 {
            t.holders = 1;
        }
        Self::nep141_event("ft_mint", json!([{ "owner_id": me, "amount": U128(total - creator_alloc), "memo": "bonding curve" }]));
        if creator_alloc > 0 {
            Self::nep141_event("ft_mint", json!([{ "owner_id": creator, "amount": U128(creator_alloc), "memo": "creator allocation (vesting)" }]));
        }
        let note = format!(
            "fixed supply {} · fee {} (can only go down) · max buy {} · max sell {} · max wallet {}",
            fmt_tokens(total),
            pct(t.rules.fee_bps),
            pct(t.rules.max_buy_bps),
            pct(t.rules.max_sell_bps),
            pct(t.rules.max_wallet_bps)
        );
        t.record("launch", creator, creator_alloc, 0, note);
        t
    }

    // ---------------------------------------------------------------- trading

    /// Buy from the curve with the attached NEAR. First-time buyers pay a
    /// one-off 0.00125 NEAR storage deposit out of the attached amount.
    #[payable]
    pub fn buy(&mut self, min_tokens_out: Option<U128>) -> U128 {
        let buyer = env::predecessor_account_id();
        let mut deposit = env::attached_deposit().as_yoctonear();
        if !self.balances.contains_key(&buyer) {
            require!(deposit > STORAGE_DEPOSIT, "ERR[STORAGE] attach at least 0.00125 NEAR for storage");
            deposit -= STORAGE_DEPOSIT;
            self.balances.insert(buyer.clone(), 0);
        }
        require!(deposit > 0, "ERR[BUY] attach NEAR to buy");
        let fee = deposit * self.rules.fee_bps as u128 / BPS;
        let near_in = deposit - fee;
        let out = self.quote_buy_inner(near_in);
        let max_buy = self.bps_of_supply(self.rules.max_buy_bps);
        if out > max_buy {
            trip(
                "MAX_BUY",
                format!(
                    "buy of {} tokens exceeds the per-transaction limit of {} ({} of supply)",
                    fmt_tokens(out),
                    fmt_tokens(max_buy),
                    pct(self.rules.max_buy_bps)
                ),
            );
        }
        let bal = self.balance(&buyer);
        self.check_wallet_cap(&buyer, bal + out);
        if let Some(m) = min_tokens_out {
            require!(out >= m.0, "ERR[SLIPPAGE] price moved; fewer tokens than min_tokens_out");
        }
        let me = env::current_account_id();
        let pool = self.balance(&me);
        require!(out < pool, "ERR[CURVE] curve sold out");
        self.balances.insert(me.clone(), pool - out);
        self.set_balance(&buyer, bal + out);
        self.curve_near += near_in;
        self.creator_fees += fee;
        self.creator_fees_total += fee;
        self.trades += 1;
        self.volume_near += deposit;
        Self::nep141_event("ft_transfer", json!([{ "old_owner_id": me, "new_owner_id": buyer, "amount": U128(out), "memo": "buy" }]));
        self.record("buy", buyer, out, deposit, format!("fee {} NEAR to creator", fmt_near(fee)));
        U128(out)
    }

    /// Sell tokens back to the curve. 1 yoctoNEAR must be attached (wallet confirmation).
    #[payable]
    pub fn sell(&mut self, amount: U128, min_near_out: Option<U128>) -> Promise {
        near_sdk::assert_one_yocto();
        let seller = env::predecessor_account_id();
        let amount = amount.0;
        require!(amount > 0, "ERR[SELL] amount must be positive");
        let max_sell = self.bps_of_supply(self.rules.max_sell_bps);
        if amount > max_sell {
            trip(
                "MAX_SELL",
                format!(
                    "sell of {} tokens exceeds the per-transaction limit of {} ({} of supply)",
                    fmt_tokens(amount),
                    fmt_tokens(max_sell),
                    pct(self.rules.max_sell_bps)
                ),
            );
        }
        let bal = self.balance(&seller);
        require!(bal >= amount, "ERR[BALANCE] not enough tokens");
        self.check_vesting(&seller, bal, amount);
        let now = env::block_timestamp();
        if self.rules.sell_cooldown_sec > 0 {
            if let Some(last) = self.last_sell_ns.get(&seller) {
                let ready = last + self.rules.sell_cooldown_sec as u64 * 1_000_000_000;
                if now < ready {
                    trip(
                        "SELL_COOLDOWN",
                        format!(
                            "one sell per {}s per wallet; next sell allowed in {}s",
                            self.rules.sell_cooldown_sec,
                            (ready - now) / 1_000_000_000 + 1
                        ),
                    );
                }
            }
        }
        let gross = self.quote_sell_inner(amount);
        if gross > self.curve_near {
            env::panic_str("ERR[CURVE] not enough real NEAR in the curve for this sell");
        }
        let fee = gross * self.rules.fee_bps as u128 / BPS;
        let out = gross - fee;
        if let Some(m) = min_near_out {
            require!(out >= m.0, "ERR[SLIPPAGE] price moved; less NEAR than min_near_out");
        }
        let me = env::current_account_id();
        self.set_balance(&seller, bal - amount);
        let pool = self.balance(&me);
        self.balances.insert(me.clone(), pool + amount);
        self.curve_near -= gross;
        self.creator_fees += fee;
        self.creator_fees_total += fee;
        self.trades += 1;
        self.volume_near += gross;
        self.last_sell_ns.insert(seller.clone(), now);
        Self::nep141_event("ft_transfer", json!([{ "old_owner_id": seller, "new_owner_id": me, "amount": U128(amount), "memo": "sell" }]));
        self.record("sell", seller.clone(), amount, out, format!("fee {} NEAR to creator", fmt_near(fee)));
        Promise::new(seller).transfer(NearToken::from_yoctonear(out))
    }

    /// Creator withdraws accrued fees. The only NEAR the creator can ever take out.
    pub fn claim_fees(&mut self) -> Promise {
        let who = env::predecessor_account_id();
        require!(who == self.creator, "ERR[AUTH] only the creator earns fees");
        let amt = self.creator_fees;
        require!(amt > 0, "ERR[FEES] nothing to claim");
        self.creator_fees = 0;
        self.record("claim_fees", who.clone(), 0, amt, "creator fee withdrawal".into());
        Promise::new(who).transfer(NearToken::from_yoctonear(amt))
    }

    /// Fee ratchet: the creator may lower the fee. Raising it trips for everyone.
    pub fn set_fee(&mut self, fee_bps: u16) {
        if fee_bps > self.rules.fee_bps {
            trip(
                "FEE_RATCHET",
                format!(
                    "creator fee can only go down: current {}, requested {}",
                    pct(self.rules.fee_bps),
                    pct(fee_bps)
                ),
            );
        }
        let who = env::predecessor_account_id();
        require!(who == self.creator, "ERR[AUTH] only the creator can lower the fee");
        let old = self.rules.fee_bps;
        self.rules.fee_bps = fee_bps;
        self.record("fee_lowered", who, 0, 0, format!("{} -> {}", pct(old), pct(fee_bps)));
    }

    // ------------------------------------------------- rug vectors (all closed)

    /// There is no mint authority. This method exists so the attempt is visible.
    pub fn mint(&mut self, amount: U128, receiver_id: Option<AccountId>) {
        let _ = receiver_id;
        trip(
            "FIXED_SUPPLY",
            format!(
                "supply is fixed at {} forever; refused to mint {} more",
                fmt_tokens(self.total_supply),
                fmt_tokens(amount.0)
            ),
        );
    }

    /// Curve NEAR belongs to holders. There is no withdraw path, for anyone.
    pub fn withdraw_liquidity(&mut self, amount: Option<U128>) {
        let _ = amount;
        trip(
            "LIQUIDITY_LOCK",
            format!(
                "{} NEAR of curve liquidity is locked in code; it only leaves through sells",
                fmt_near(self.curve_near)
            ),
        );
    }

    /// Rules have no setter.
    pub fn set_rules(&mut self, rules: Option<Rules>) {
        let _ = rules;
        trip("IMMUTABLE_RULES", "rules were fixed at launch and have no setter".into());
    }

    /// Ownership cannot move: the fee recipient is fixed and the account has no keys.
    pub fn transfer_ownership(&mut self, new_owner: AccountId) {
        trip(
            "IMMUTABLE_RULES",
            format!("creator role is fixed; refused to hand control to {new_owner}"),
        );
    }

    /// Code cannot be replaced: the account was created without access keys.
    pub fn upgrade(&mut self) {
        trip(
            "IMMUTABLE_CODE",
            "this account has zero access keys and no upgrade method; the code is final".into(),
        );
    }

    // ------------------------------------------------------------ NEP-141 core

    #[payable]
    pub fn ft_transfer(&mut self, receiver_id: AccountId, amount: U128, memo: Option<String>) {
        near_sdk::assert_one_yocto();
        let sender = env::predecessor_account_id();
        self.internal_transfer(&sender, &receiver_id, amount.0, memo);
    }

    #[payable]
    pub fn ft_transfer_call(
        &mut self,
        receiver_id: AccountId,
        amount: U128,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<U128> {
        near_sdk::assert_one_yocto();
        require!(
            env::prepaid_gas() > GAS_FT_ON_TRANSFER.saturating_add(GAS_RESOLVE).saturating_add(Gas::from_tgas(10)),
            "ERR[GAS] more gas is required"
        );
        let sender = env::predecessor_account_id();
        self.internal_transfer(&sender, &receiver_id, amount.0, memo);
        ext_receiver::ext(receiver_id.clone())
            .with_static_gas(GAS_FT_ON_TRANSFER)
            .ft_on_transfer(sender.clone(), amount, msg)
            .then(
                ext_self::ext(env::current_account_id())
                    .with_static_gas(GAS_RESOLVE)
                    .ft_resolve_transfer(sender, receiver_id, amount),
            )
            .into()
    }

    #[private]
    pub fn ft_resolve_transfer(&mut self, sender_id: AccountId, receiver_id: AccountId, amount: U128) -> U128 {
        let amount = amount.0;
        let unused = match env::promise_result(0) {
            PromiseResult::Successful(v) => near_sdk::serde_json::from_slice::<U128>(&v)
                .map(|u| u.0.min(amount))
                .unwrap_or(amount),
            PromiseResult::Failed => amount,
        };
        if unused > 0 {
            let rb = self.balance(&receiver_id);
            let refund = unused.min(rb);
            if refund > 0 {
                self.set_balance(&receiver_id, rb - refund);
                let sb = self.balance(&sender_id);
                self.set_balance(&sender_id, sb + refund);
                Self::nep141_event("ft_transfer", json!([{ "old_owner_id": receiver_id, "new_owner_id": sender_id, "amount": U128(refund), "memo": "refund" }]));
                return U128(amount - refund);
            }
        }
        U128(amount)
    }

    pub fn ft_total_supply(&self) -> U128 {
        U128(self.total_supply)
    }

    pub fn ft_balance_of(&self, account_id: AccountId) -> U128 {
        U128(self.balance(&account_id))
    }

    pub fn ft_metadata(&self) -> FtMetadata {
        FtMetadata {
            spec: "ft-1.0.0".into(),
            name: self.name.clone(),
            symbol: self.symbol.clone(),
            icon: self.icon.clone(),
            reference: None,
            reference_hash: None,
            decimals: DECIMALS,
        }
    }

    // ------------------------------------------------------------ NEP-145 lite

    #[payable]
    pub fn storage_deposit(&mut self, account_id: Option<AccountId>, registration_only: Option<bool>) -> StorageBalance {
        let _ = registration_only;
        let acc = account_id.unwrap_or_else(env::predecessor_account_id);
        let dep = env::attached_deposit().as_yoctonear();
        if self.balances.contains_key(&acc) {
            if dep > 0 {
                Promise::new(env::predecessor_account_id()).transfer(NearToken::from_yoctonear(dep)).detach();
            }
        } else {
            require!(dep >= STORAGE_DEPOSIT, "ERR[STORAGE] attach 0.00125 NEAR");
            self.balances.insert(acc, 0);
            let refund = dep - STORAGE_DEPOSIT;
            if refund > 0 {
                Promise::new(env::predecessor_account_id()).transfer(NearToken::from_yoctonear(refund)).detach();
            }
        }
        StorageBalance { total: U128(STORAGE_DEPOSIT), available: U128(0) }
    }

    pub fn storage_balance_of(&self, account_id: AccountId) -> Option<StorageBalance> {
        self.balances
            .contains_key(&account_id)
            .then(|| StorageBalance { total: U128(STORAGE_DEPOSIT), available: U128(0) })
    }

    pub fn storage_balance_bounds(&self) -> StorageBalanceBounds {
        StorageBalanceBounds { min: U128(STORAGE_DEPOSIT), max: Some(U128(STORAGE_DEPOSIT)) }
    }

    // ------------------------------------------------------------------ views

    pub fn tripwire_info(&self) -> Info {
        let me = env::current_account_id();
        let curve_tokens = self.balance(&me);
        Info {
            name: self.name.clone(),
            symbol: self.symbol.clone(),
            icon: self.icon.clone(),
            tagline: self.tagline.clone(),
            creator: self.creator.clone(),
            factory: self.factory.clone(),
            decimals: DECIMALS,
            total_supply: U128(self.total_supply),
            rules: self.rules.clone(),
            fee_cap_bps: self.fee_cap_bps,
            launched_at_ms: self.launched_at_ns / 1_000_000,
            curve_tokens: U128(curve_tokens),
            curve_near: U128(self.curve_near),
            virtual_near: U128(self.virtual_near),
            price_yocto_per_token: U128(mul_div(self.virtual_near + self.curve_near, ONE_TOKEN, curve_tokens.max(1))),
            creator_alloc: U128(self.creator_alloc),
            creator_locked: U128(self.locked_now()),
            creator_fees_unclaimed: U128(self.creator_fees),
            creator_fees_total: U128(self.creator_fees_total),
            max_buy_tokens: U128(self.bps_of_supply(self.rules.max_buy_bps)),
            max_sell_tokens: U128(self.bps_of_supply(self.rules.max_sell_bps)),
            max_wallet_tokens: U128(self.bps_of_supply(self.rules.max_wallet_bps)),
            holders: self.holders,
            trades: self.trades,
            volume_near: U128(self.volume_near),
            event_count: self.event_count,
        }
    }

    pub fn wallet_status(&self, account_id: AccountId) -> WalletStatus {
        let bal = self.balance(&account_id);
        let locked = if account_id == self.creator { self.locked_now().min(bal) } else { 0 };
        let now = env::block_timestamp();
        let ready = self
            .last_sell_ns
            .get(&account_id)
            .map(|l| l + self.rules.sell_cooldown_sec as u64 * 1_000_000_000)
            .unwrap_or(0);
        let cap = self.bps_of_supply(self.rules.max_wallet_bps);
        WalletStatus {
            balance: U128(bal),
            registered: self.balances.contains_key(&account_id),
            locked: U128(locked),
            sell_ready_in_sec: if ready > now { ((ready - now) / 1_000_000_000 + 1) as u32 } else { 0 },
            wallet_room: U128(cap.saturating_sub(bal)),
        }
    }

    /// Tokens out for `near_in` yoctoNEAR attached (after fee; storage not included).
    pub fn quote_buy(&self, near_in: U128) -> U128 {
        let net = near_in.0 - near_in.0 * self.rules.fee_bps as u128 / BPS;
        U128(self.quote_buy_inner(net))
    }

    /// NEAR out (after fee) for selling `amount` tokens.
    pub fn quote_sell(&self, amount: U128) -> U128 {
        let g = self.quote_sell_inner(amount.0);
        U128(g - g * self.rules.fee_bps as u128 / BPS)
    }

    /// Newest-first slice of the on-chain event log (last 64 kept).
    pub fn events(&self, limit: Option<u32>) -> Vec<Event> {
        let n = self.events.len();
        let limit = limit.unwrap_or(EVENT_CAP).min(n);
        let mut v: Vec<Event> = (0..n).filter_map(|i| self.events.get(i).cloned()).collect();
        v.sort_by(|a, b| b.id.cmp(&a.id));
        v.truncate(limit as usize);
        v
    }

    // --------------------------------------------------------------- internal

    fn balance(&self, a: &AccountId) -> u128 {
        self.balances.get(a).copied().unwrap_or(0)
    }

    fn set_balance(&mut self, a: &AccountId, v: u128) {
        let prev = self.balance(a);
        if prev == 0 && v > 0 {
            self.holders += 1;
        } else if prev > 0 && v == 0 {
            self.holders = self.holders.saturating_sub(1);
        }
        self.balances.insert(a.clone(), v);
    }

    fn bps_of_supply(&self, bps: u16) -> u128 {
        self.total_supply * bps as u128 / BPS
    }

    fn quote_buy_inner(&self, near_in: u128) -> u128 {
        let t = self.balance(&env::current_account_id());
        let n = self.virtual_near + self.curve_near;
        mul_div(t, near_in, n + near_in)
    }

    fn quote_sell_inner(&self, amount: u128) -> u128 {
        let t = self.balance(&env::current_account_id());
        let n = self.virtual_near + self.curve_near;
        mul_div(n, amount, t + amount)
    }

    fn locked_now(&self) -> u128 {
        if self.creator_alloc == 0 {
            return 0;
        }
        let dur = self.rules.creator_vest_days as u128 * 86_400 * 1_000_000_000;
        let el = (env::block_timestamp() - self.launched_at_ns) as u128;
        if el >= dur {
            0
        } else {
            mul_div(self.creator_alloc, dur - el, dur)
        }
    }

    fn check_vesting(&self, who: &AccountId, bal: u128, amount: u128) {
        if *who != self.creator {
            return;
        }
        let locked = self.locked_now();
        if bal.saturating_sub(amount) < locked {
            trip(
                "VESTING_LOCK",
                format!(
                    "creator has {} tokens still vesting ({} days linear); only {} can move now",
                    fmt_tokens(locked),
                    self.rules.creator_vest_days,
                    fmt_tokens(bal.saturating_sub(locked))
                ),
            );
        }
    }

    fn check_wallet_cap(&self, who: &AccountId, new_bal: u128) {
        let cap = self.bps_of_supply(self.rules.max_wallet_bps);
        if *who != env::current_account_id() && new_bal > cap {
            trip(
                "MAX_WALLET",
                format!(
                    "{} would hold {} tokens; max per wallet is {} ({} of supply)",
                    who,
                    fmt_tokens(new_bal),
                    fmt_tokens(cap),
                    pct(self.rules.max_wallet_bps)
                ),
            );
        }
    }

    fn internal_transfer(&mut self, from: &AccountId, to: &AccountId, amount: u128, memo: Option<String>) {
        require!(from != to, "ERR[TRANSFER] sender and receiver are the same");
        require!(amount > 0, "ERR[TRANSFER] amount must be positive");
        require!(*to != env::current_account_id(), "ERR[TRANSFER] use sell() to sell into the curve");
        require!(self.balances.contains_key(to), "ERR[STORAGE] receiver is not registered (storage_deposit)");
        let fb = self.balance(from);
        require!(fb >= amount, "ERR[BALANCE] not enough tokens");
        self.check_vesting(from, fb, amount);
        let tb = self.balance(to);
        self.check_wallet_cap(to, tb + amount);
        self.set_balance(from, fb - amount);
        self.set_balance(to, tb + amount);
        Self::nep141_event("ft_transfer", json!([{ "old_owner_id": from, "new_owner_id": to, "amount": U128(amount), "memo": memo }]));
        self.record("transfer", from.clone(), amount, 0, format!("to {to}"));
    }

    fn record(&mut self, kind: &str, actor: AccountId, tokens: u128, near: u128, note: String) {
        let ev = Event {
            id: self.event_count,
            kind: kind.into(),
            actor,
            tokens: U128(tokens),
            near: U128(near),
            ts_ms: env::block_timestamp_ms(),
            note,
        };
        if self.events.len() < EVENT_CAP {
            self.events.push(ev);
        } else {
            let idx = (self.event_count % EVENT_CAP as u64) as u32;
            self.events.set(idx, ev);
        }
        self.event_count += 1;
    }

    fn nep141_event(event: &str, data: near_sdk::serde_json::Value) {
        env::log_str(&format!(
            "EVENT_JSON:{}",
            json!({ "standard": "nep141", "version": "1.0.0", "event": event, "data": data })
        ));
    }
}

#[cfg(test)]
mod tests;
