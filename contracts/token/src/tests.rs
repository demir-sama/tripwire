use super::*;
use near_sdk::test_utils::{get_logs, VMContextBuilder};
use near_sdk::testing_env;

const DAY_NS: u64 = 86_400 * 1_000_000_000;

fn acc(s: &str) -> AccountId {
    s.parse().unwrap()
}

fn ctx(pred: &str, dep: u128, ts: u64) {
    let mut b = VMContextBuilder::new();
    b.current_account_id(acc("pepe.tripwire.testnet"))
        .predecessor_account_id(acc(pred))
        .attached_deposit(NearToken::from_yoctonear(dep))
        .block_timestamp(ts);
    testing_env!(b.build());
}

fn rules() -> Rules {
    Rules {
        max_buy_bps: 100,
        max_sell_bps: 50,
        max_wallet_bps: 200,
        fee_bps: 100,
        sell_cooldown_sec: 60,
        creator_alloc_bps: 500,
        creator_vest_days: 30,
    }
}

fn launch() -> Token {
    ctx("tripwire.testnet", 0, DAY_NS);
    Token::new(
        acc("creator.testnet"),
        "Pepe With Rules".into(),
        "PEPE".into(),
        None,
        "the joke needs rules".into(),
        U128(1_000_000_000),
        U128(30 * ONE_NEAR),
        rules(),
    )
}

fn expect_trip<F: FnOnce() + std::panic::UnwindSafe>(rule: &str, f: F) {
    let err = std::panic::catch_unwind(f).expect_err("expected the rule to trip");
    let msg = err
        .downcast_ref::<String>()
        .cloned()
        .or_else(|| err.downcast_ref::<&str>().map(|s| s.to_string()))
        .unwrap_or_default();
    assert!(msg.contains(&format!("TRIPWIRE[{rule}]")), "wanted {rule}, got: {msg}");
}

#[test]
fn mul_div_handles_256_bit_intermediates() {
    assert_eq!(mul_div(10, 20, 4), 50);
    let big = 1_000_000_000_000_000_000_000_000_000u128; // 1e27
    assert_eq!(mul_div(big, 100 * ONE_NEAR, 100 * ONE_NEAR), big);
    assert_eq!(mul_div(u128::MAX, 2, 4), u128::MAX / 2);
}

#[test]
fn launch_mints_fixed_supply_to_curve_and_vesting_creator() {
    let t = launch();
    let i = t.tripwire_info();
    assert_eq!(i.total_supply.0, 1_000_000_000 * ONE_TOKEN);
    assert_eq!(i.creator_alloc.0, 50_000_000 * ONE_TOKEN);
    assert_eq!(i.curve_tokens.0, 950_000_000 * ONE_TOKEN);
    assert_eq!(i.creator_locked.0, i.creator_alloc.0);
    assert!(get_logs().iter().any(|l| l.contains("ft_mint")));
}

#[test]
fn small_buy_and_sell_work_and_pay_creator_fee() {
    let mut t = launch();
    ctx("alice.testnet", ONE_NEAR / 10 + STORAGE_DEPOSIT, DAY_NS + 1);
    let got = t.buy(None).0;
    assert!(got > 0);
    assert_eq!(t.ft_balance_of(acc("alice.testnet")).0, got);
    assert_eq!(t.tripwire_info().creator_fees_unclaimed.0, ONE_NEAR / 1000);
    ctx("alice.testnet", 1, DAY_NS + 2);
    let _ = t.sell(U128(got / 2), None);
    assert_eq!(t.ft_balance_of(acc("alice.testnet")).0, got - got / 2);
}

#[test]
fn whale_buy_trips_max_buy() {
    let mut t = launch();
    ctx("whale.testnet", 5 * ONE_NEAR, DAY_NS + 1);
    expect_trip("MAX_BUY", move || {
        t.buy(None);
    });
}

#[test]
fn stacking_buys_trips_max_wallet() {
    let mut t = launch();
    for _ in 0..2 {
        ctx("stacker.testnet", 3 * ONE_NEAR / 10, DAY_NS + 1);
        t.buy(None);
    }
    ctx("stacker.testnet", 3 * ONE_NEAR / 10, DAY_NS + 1);
    expect_trip("MAX_WALLET", move || {
        for _ in 0..5 {
            t.buy(None);
        }
    });
}

#[test]
fn creator_dump_trips_max_sell() {
    let mut t = launch();
    ctx("creator.testnet", 1, DAY_NS * 40);
    expect_trip("MAX_SELL", move || {
        let _ = t.sell(U128(20_000_000 * ONE_TOKEN), None);
    });
}

#[test]
fn creator_selling_unvested_trips_vesting_lock() {
    let mut t = launch();
    ctx("creator.testnet", 1, DAY_NS + 10);
    expect_trip("VESTING_LOCK", move || {
        let _ = t.sell(U128(1_000_000 * ONE_TOKEN), None);
    });
}

#[test]
fn creator_transfer_of_unvested_trips_vesting_lock() {
    let mut t = launch();
    ctx("friend.testnet", STORAGE_DEPOSIT, DAY_NS + 5);
    t.storage_deposit(None, None);
    ctx("creator.testnet", 1, DAY_NS + 10);
    expect_trip("VESTING_LOCK", move || {
        t.ft_transfer(acc("friend.testnet"), U128(1_000_000 * ONE_TOKEN), None);
    });
}

#[test]
fn vesting_releases_linearly() {
    let t = launch();
    ctx("x.testnet", 0, DAY_NS + 15 * DAY_NS);
    let half = t.tripwire_info().creator_locked.0;
    assert_eq!(half, 25_000_000 * ONE_TOKEN);
}

#[test]
fn quick_second_sell_trips_cooldown() {
    let mut t = launch();
    ctx("bob.testnet", ONE_NEAR / 5, DAY_NS + 1);
    let got = t.buy(None).0;
    ctx("bob.testnet", 1, DAY_NS + 2);
    let _ = t.sell(U128(got / 4), None);
    ctx("bob.testnet", 1, DAY_NS + 3);
    expect_trip("SELL_COOLDOWN", move || {
        let _ = t.sell(U128(got / 4), None);
    });
}

#[test]
fn fee_ratchet_only_goes_down() {
    let mut t = launch();
    ctx("creator.testnet", 0, DAY_NS + 1);
    t.set_fee(50);
    assert_eq!(t.tripwire_info().rules.fee_bps, 50);
    expect_trip("FEE_RATCHET", move || t.set_fee(100));
}

#[test]
fn mint_withdraw_rules_upgrade_all_trip() {
    let t = launch();
    ctx("creator.testnet", 0, DAY_NS + 1);
    let mut a = t;
    expect_trip("FIXED_SUPPLY", std::panic::AssertUnwindSafe(|| a.mint(U128(1), None)));
    expect_trip("LIQUIDITY_LOCK", std::panic::AssertUnwindSafe(|| a.withdraw_liquidity(None)));
    expect_trip("IMMUTABLE_RULES", std::panic::AssertUnwindSafe(|| a.set_rules(None)));
    expect_trip("IMMUTABLE_RULES", std::panic::AssertUnwindSafe(|| a.transfer_ownership(acc("evil.testnet"))));
    expect_trip("IMMUTABLE_CODE", std::panic::AssertUnwindSafe(|| a.upgrade()));
}

#[test]
#[should_panic(expected = "ERR[RULES] creator fee above 5% cap")]
fn launch_rejects_out_of_bounds_rules() {
    ctx("tripwire.testnet", 0, DAY_NS);
    let mut r = rules();
    r.fee_bps = 900;
    Token::new(acc("c.testnet"), "X".into(), "X".into(), None, "".into(), U128(1_000_000_000), U128(30 * ONE_NEAR), r);
}

#[test]
fn claim_fees_pays_only_creator() {
    let mut t = launch();
    ctx("alice.testnet", ONE_NEAR / 10, DAY_NS + 1);
    t.buy(None);
    ctx("creator.testnet", 0, DAY_NS + 2);
    let _ = t.claim_fees();
    assert_eq!(t.tripwire_info().creator_fees_unclaimed.0, 0);
}
