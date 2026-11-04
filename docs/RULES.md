# Contract rules

Every token launched by Tripwire carries a `Rules` struct fixed in `new()`. There is no setter. Each rule is checked inside the token contract, and a violation panics with:

```
TRIPWIRE[<RULE>] <human-readable reason>
```

Panics revert the whole transaction: no tokens or NEAR move, and attached deposits are refunded. Because the format is fixed, anything that reads failed receipts (the app's audit feed, an explorer, a bot) can tell which rule caught the attempt.

Errors that are not rule trips (bad input, slippage, insufficient balance) use `ERR[<KIND>] …` instead, so they never look like a blocked rug.

## Launch parameters and hard bounds

A creator picks values inside protocol bounds. `Rules::validate()` rejects anything outside them at launch with `ERR[RULES]`.

| Field | Meaning | Allowed range |
|---|---|---|
| `max_buy_bps` | max tokens bought in one tx, share of supply | 0.1% – 5% (10–500 bps) |
| `max_sell_bps` | max tokens sold in one tx | 0.1% – 5% |
| `max_wallet_bps` | max balance any wallet may hold | 0.5% – 20%, and ≥ max buy |
| `fee_bps` | creator fee on every buy and sell (in NEAR) | 0 – 5%; this value is also the ceiling forever |
| `sell_cooldown_sec` | gap between two sells from one wallet | 0 – 86,400 s |
| `creator_alloc_bps` | tokens minted to the creator at launch | 0 – 10% |
| `creator_vest_days` | linear vesting of that allocation | 1 – 365 days (when allocation > 0) |
| supply | fixed total, whole tokens, 18 decimals | 1M – 1T |

The launch form's presets:

| Preset | Buy | Sell | Wallet | Fee | Cooldown | Dev bag |
|---|---|---|---|---|---|---|
| Fortress | 0.5% | 0.25% | 1.5% | 0.5% | 300 s | 1% / 90 d |
| Balanced | 1% | 0.5% | 3% | 1% | 60 s | 2% / 30 d |
| Loose but safe | 3% | 2% | 10% | 2% | 15 s | 5% / 14 d |

Every preset keeps `dev bag + max buy <= max wallet`, so the creator's vesting allocation never puts their own wallet over the `MAX_WALLET` cap on their first full-size buy. The form warns when custom settings break that.

## The ten rules

### 01 `FIXED_SUPPLY`
Supply is minted once in `new()` (curve inventory plus the creator allocation). `mint()` exists only to fail:
`TRIPWIRE[FIXED_SUPPLY] supply is fixed at 1,000,000,000 forever; refused to mint 1,000,000,000 more`

### 02 `LIQUIDITY_LOCK`
NEAR paid into the curve stays in the token account. The only path out is `sell()`, priced by the curve. `withdraw_liquidity()` always fails:
`TRIPWIRE[LIQUIDITY_LOCK] 0.1967 NEAR of curve liquidity is locked in code; it only leaves through sells`

### 03 `VESTING_LOCK`
`locked = alloc × (1 − elapsed / vest_period)`. The creator can't sell or `ft_transfer` below the locked amount:
`TRIPWIRE[VESTING_LOCK] creator has 49,985,736 tokens still vesting (30 days linear); only 14,263 can move now`

### 04 `MAX_SELL`
`TRIPWIRE[MAX_SELL] sell of 40,000,000 tokens exceeds the per-transaction limit of 5,000,000 (0.50% of supply)`

### 05 `MAX_BUY`
Checked on the quoted output before any state changes. The attached NEAR comes back.
`TRIPWIRE[MAX_BUY] buy of 57,986,134 tokens exceeds the per-transaction limit of 10,000,000 (1.00% of supply)`

### 06 `MAX_WALLET`
Applied to buys and to `ft_transfer` / `ft_transfer_call` receivers (the token contract itself is exempt).

### 07 `FEE_RATCHET`
`set_fee(x)` with `x` above the current fee fails for everyone, creator included. Lowering is creator-only.
`TRIPWIRE[FEE_RATCHET] creator fee can only go down: current 1.00%, requested 5.00%`

### 08 `SELL_COOLDOWN`
`TRIPWIRE[SELL_COOLDOWN] one sell per 60s per wallet; next sell allowed in 45s`

### 09 `IMMUTABLE_RULES`
`set_rules()` and `transfer_ownership()` exist only to fail:
`TRIPWIRE[IMMUTABLE_RULES] rules were fixed at launch and have no setter`
`TRIPWIRE[IMMUTABLE_RULES] creator role is fixed; refused to hand control to burner-wallet.testnet`

### 10 `IMMUTABLE_CODE`
The factory creates each token account without adding a key, so no one can sign a `DeployContract`. The code is a reference to a global contract hash. `upgrade()` fails as well:
`TRIPWIRE[IMMUTABLE_CODE] this account has zero access keys and no upgrade method; the code is final`

Check it yourself:

```bash
near account list-keys grug.tripwire.testnet network-config testnet now   # → no keys
```

## Tests

`contracts/token/src/tests.rs` covers launch validation, the curve round trip, and every rule above (14 tests):

```bash
cd contracts/token && cargo test
```
