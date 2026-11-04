//! Tripwire factory: launches rule-bound meme tokens.
//!
//! Each launch creates `<symbol>.<factory>` as a sub-account that runs the
//! shared Tripwire token code (a NEAR global contract, pinned by code hash)
//! and is created WITHOUT any access key. After the init call, nobody can
//! sign for that account again, so the code and its rules are final.

use near_sdk::json_types::{Base58CryptoHash, U128};
use near_sdk::serde_json::{json, Value};
use near_sdk::store::{LookupMap, Vector};
use near_sdk::{
    env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise, PromiseResult,
};

/// Minimum NEAR attached to `launch`; all of it moves to the token account to pay its storage.
pub const MIN_LAUNCH_DEPOSIT: u128 = 300_000_000_000_000_000_000_000; // 0.3 NEAR
pub const VIRTUAL_NEAR: u128 = 30_000_000_000_000_000_000_000_000; // 30 NEAR curve depth
const GAS_INIT: Gas = Gas::from_tgas(40);
const GAS_CB: Gas = Gas::from_tgas(15);

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct TokenEntry {
    pub account_id: AccountId,
    pub symbol: String,
    pub name: String,
    pub creator: AccountId,
    pub created_at_ms: u64,
}

#[near(serializers = [json])]
pub struct Config {
    pub owner: AccountId,
    pub token_code_hash: Base58CryptoHash,
    pub min_launch_deposit: U128,
    pub virtual_near: U128,
    pub launches: u32,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Factory {
    owner: AccountId,
    token_code_hash: Base58CryptoHash,
    tokens: Vector<TokenEntry>,
    by_symbol: LookupMap<String, u32>,
    pending: LookupMap<String, bool>,
}

fn valid_symbol(s: &str) -> bool {
    (2..=10).contains(&s.len()) && s.chars().all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
}

#[near]
impl Factory {
    #[init]
    pub fn new(owner: AccountId, token_code_hash: Base58CryptoHash) -> Self {
        Self {
            owner,
            token_code_hash,
            tokens: Vector::new(b"t"),
            by_symbol: LookupMap::new(b"s"),
            pending: LookupMap::new(b"p"),
        }
    }

    /// Launch a token. `rules` is passed straight to the token's `new`, which
    /// rejects anything outside the hard limits (fee <= 5%, etc).
    #[payable]
    pub fn launch(
        &mut self,
        name: String,
        symbol: String,
        tagline: Option<String>,
        icon: Option<String>,
        supply_whole: Option<U128>,
        rules: Value,
    ) -> Promise {
        let creator = env::predecessor_account_id();
        let deposit = env::attached_deposit().as_yoctonear();
        require!(deposit >= MIN_LAUNCH_DEPOSIT, "ERR[LAUNCH] attach at least 0.3 NEAR for token storage");
        require!(valid_symbol(&symbol), "ERR[LAUNCH] symbol must be 2-10 chars A-Z / 0-9");
        require!(
            !self.by_symbol.contains_key(&symbol) && !self.pending.contains_key(&symbol),
            "ERR[LAUNCH] symbol already taken"
        );
        let account_id: AccountId = format!("{}.{}", symbol.to_lowercase(), env::current_account_id())
            .parse()
            .unwrap_or_else(|_| env::panic_str("ERR[LAUNCH] invalid account id"));
        self.pending.insert(symbol.clone(), true);
        let args = json!({
            "creator": creator,
            "name": name,
            "symbol": symbol,
            "icon": icon,
            "tagline": tagline.unwrap_or_default(),
            "supply_whole": supply_whole.unwrap_or(U128(1_000_000_000)),
            "virtual_near": U128(VIRTUAL_NEAR),
            "rules": rules,
        });
        // No add_full_access_key / add_access_key: the account is born keyless.
        Promise::new(account_id.clone())
            .create_account()
            .transfer(NearToken::from_yoctonear(deposit))
            .use_global_contract(self.token_code_hash)
            .function_call("new".to_string(), args.to_string().into_bytes(), NearToken::from_yoctonear(0), GAS_INIT)
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_CB)
                    .on_launch(account_id, symbol, name, creator, U128(deposit)),
            )
    }

    #[private]
    pub fn on_launch(
        &mut self,
        account_id: AccountId,
        symbol: String,
        name: String,
        creator: AccountId,
        deposit: U128,
    ) -> Option<AccountId> {
        self.pending.remove(&symbol);
        match env::promise_result(0) {
            PromiseResult::Successful(_) => {
                let idx = self.tokens.len();
                self.tokens.push(TokenEntry {
                    account_id: account_id.clone(),
                    symbol: symbol.clone(),
                    name,
                    creator: creator.clone(),
                    created_at_ms: env::block_timestamp_ms(),
                });
                self.by_symbol.insert(symbol.clone(), idx);
                env::log_str(&format!(
                    "EVENT_JSON:{}",
                    json!({"standard":"tripwire","version":"1.0.0","event":"launch","data":[{"token":account_id,"symbol":symbol,"creator":creator}]})
                ));
                Some(account_id)
            }
            PromiseResult::Failed => {
                // The failed batch refunded the deposit to this factory; return it.
                Promise::new(creator).transfer(NearToken::from_yoctonear(deposit.0)).detach();
                None
            }
        }
    }

    /// Owner can point FUTURE launches at new token code. Launched tokens are
    /// keyless and unaffected.
    pub fn set_token_code_hash(&mut self, token_code_hash: Base58CryptoHash) {
        require!(env::predecessor_account_id() == self.owner, "ERR[AUTH] owner only");
        self.token_code_hash = token_code_hash;
    }

    pub fn config(&self) -> Config {
        Config {
            owner: self.owner.clone(),
            token_code_hash: self.token_code_hash,
            min_launch_deposit: U128(MIN_LAUNCH_DEPOSIT),
            virtual_near: U128(VIRTUAL_NEAR),
            launches: self.tokens.len(),
        }
    }

    /// Newest first.
    pub fn tokens(&self, from: Option<u32>, limit: Option<u32>) -> Vec<TokenEntry> {
        let n = self.tokens.len();
        let from = from.unwrap_or(0);
        let limit = limit.unwrap_or(50).min(100);
        (0..n)
            .rev()
            .skip(from as usize)
            .take(limit as usize)
            .filter_map(|i| self.tokens.get(i).cloned())
            .collect()
    }

    pub fn token(&self, symbol: String) -> Option<TokenEntry> {
        self.by_symbol.get(&symbol).and_then(|i| self.tokens.get(*i).cloned())
    }
}
