<p align="center"><img src="web/public/icon.svg" width="72" alt="Tripwire"></p>

<h1 align="center">Tripwire</h1>
<p align="center"><b>Meme tokens with rules.</b> Buy and sell limits, max wallet, creator fee, vesting and a liquidity lock, all enforced by a NEAR contract. If you try to rug one, the transaction fails on-chain and the error names the rule you broke.</p>

<p align="center">
  <a href="https://tripwire-sama-5806.vercel.app">Live app</a> ·
  <a href="https://tripwire-sama-5806.vercel.app/t/GRUG#rug">Rug lab</a> ·
  <a href="docs/ARCHITECTURE.md">Architecture</a> ·
  <a href="docs/RULES.md">Rules</a> ·
  <a href="docs/SETUP.md">Setup</a>
</p>

> Built at **NEAR HACKATHON** (Nov 2026), track **Memecoins With Mechanics** (`memecoins`). Runs on NEAR testnet only. Not audited.

## Links

| | |
|---|---|
| Live app | https://tripwire-sama-5806.vercel.app |
| Demo video (X) | [x.com/samaisback/status/2118030472676769978](https://x.com/samaisback/status/2118030472676769978) |
| Repository | https://github.com/demir-sama/tripwire (MIT) |
| Factory contract | [`tripwire.testnet`](https://testnet.nearblocks.io/address/tripwire.testnet) |
| A failed rug tx | [`B37X2Ur6k98uQS9T1qTHRatcYQM6JuVQXzzYzwjrzP6c`](https://testnet.nearblocks.io/txns/B37X2Ur6k98uQS9T1qTHRatcYQM6JuVQXzzYzwjrzP6c): `withdraw_liquidity` on `sprung.tripwire.testnet` → `TRIPWIRE[LIQUIDITY_LOCK] 0.0497 NEAR of curve liquidity is locked in code; it only leaves through sells` |

## The problem

Meme coins usually die in a handful of predictable ways. The dev dumps the team bag, mints more supply, raises the tax, or pulls the liquidity. Each of these starts with a promise like "LP is locked" that holders can't check.

## What Tripwire does

Tripwire replaces those promises with contract code. Every token is its own NEAR account. It runs pinned global contract code and has **zero access keys**, so nobody can redeploy it. Ten rules are checked on every call. When an action breaks a rule, the contract panics with `TRIPWIRE[RULE_NAME] <human-readable reason>`. Nothing moves, and the failed transaction stays on-chain as proof.

- **Launch form** (`/launch`). Pick a name, a symbol, a supply and a rule set: Fortress, Balanced, Loose but safe, or custom sliders. One transaction to the factory creates `<symbol>.tripwire.testnet`.
- **Token page** (`/t/<SYMBOL>`). Shows live rule status read from chain, price and curve stats, and buy and sell with pre-flight warnings ("this will trip MAX_WALLET"). It also has creator tools and an audit feed that merges on-chain events with **failed transactions**, parsed for their `TRIPWIRE[RULE]` code.
- **Rug lab** (`/t/GRUG#rug`). Nine rug attempts: dump the vesting bag, giant sell, mint, raise the fee, pull the liquidity, rewrite the rules, hand off ownership, swap the code, snipe the curve. You can fire them with no wallet as the real creator of `$GRUG` (a rate-limited server key signs). You can also use your own wallet against any token. Every attempt is a real testnet transaction that fails and names the rule.

## The ten rules

| # | Code | The usual promise | What the contract does |
|---|------|-------------------|------------------------|
| 01 | `FIXED_SUPPLY` | "We'll never mint more" | There is no mint path. `mint()` always panics. |
| 02 | `LIQUIDITY_LOCK` | "LP is locked" | Curve NEAR stays inside the token contract and only leaves through sells. `withdraw_liquidity()` always panics. |
| 03 | `VESTING_LOCK` | "Team tokens are vested" | The creator allocation unlocks linearly. Selling or transferring locked tokens panics. |
| 04 | `MAX_SELL` | "We won't dump" | Every sell is capped at a share of supply. |
| 05 | `MAX_BUY` | "Fair launch" | Every buy is capped. The deposit is refunded when a buy trips. |
| 06 | `MAX_WALLET` | "No whales" | A buy or transfer that would push a wallet over the cap panics. |
| 07 | `FEE_RATCHET` | "Fees stay low" | The creator fee can only go down. |
| 08 | `SELL_COOLDOWN` | "No bot dumps" | Each wallet gets one sell per cooldown window. |
| 09 | `IMMUTABLE_RULES` | "We won't change the rules" | There is no rule setter, and the creator role can't be handed off. |
| 10 | `IMMUTABLE_CODE` | "Contract is renounced" | Token accounts have zero keys and no upgrade method. |

Bounds, error formats and preset values are in [docs/RULES.md](docs/RULES.md).

## Try it: do X, see Y

All steps run on NEAR testnet and cost nothing. For the wallet steps, get free test NEAR from https://near-faucet.io and use [Intear Wallet](https://wallet.intear.tech), Meteor, HOT or Sender.

1. **Watch a rug fail without a wallet.** Open https://tripwire-sama-5806.vercel.app/t/GRUG#rug and click **Pull the liquidity**.
   **You should see** a "TRIPPED" card with `TRIPWIRE[LIQUIDITY_LOCK] …` and a link to the failed tx on nearblocks. After 10–20 s, the audit feed on the same page lists it as a blocked attempt.
2. **Try the other rug vectors.** In the same rug lab, click **Print a billion more**, **Crank the fee to 5%**, **Dump the dev bag** and **Swap the contract**.
   **You should see** each one fail with its own code: `FIXED_SUPPLY`, `FEE_RATCHET`, `VESTING_LOCK`, `IMMUTABLE_CODE`. The rule board's trip counters go up.
3. **Check that the token is keyless.** Run `near account list-keys grug.tripwire.testnet network-config testnet now`, or look at the token page header.
   **You should see** 0 access keys and the global code hash `B4tk97kLWUVMVfPYXcLvAqxTr9viJAeFaaEhqHqPYY3c`.
4. **Launch your own token.** Connect a wallet, open `/launch`, enter a name and symbol, pick **Fortress**, **Balanced** or **Loose but safe**, and approve the transaction (0.3 test NEAR, used for storage).
   **You should see** a "launched" screen, and then a redirect to `/t/<SYMBOL>` with your rules shown as armed. Your vesting allocation appears as locked.
5. **Trip a trading rule.** On your token, buy more than the max-buy share.
   **You should see** a pre-flight warning. If you send the buy anyway, it fails with `TRIPWIRE[MAX_BUY]` and your deposit is refunded. Make a normal buy, then sell twice within the cooldown. **You should see** the second sell fail with `TRIPWIRE[SELL_COOLDOWN]`.
6. **Verify a failure independently.** Open the failed tx above, [`B37X2Ur6…`](https://testnet.nearblocks.io/txns/B37X2Ur6k98uQS9T1qTHRatcYQM6JuVQXzzYzwjrzP6c).
   **You should see** a `withdraw_liquidity` call to `sprung.tripwire.testnet` that failed with a `TRIPWIRE[LIQUIDITY_LOCK]` panic.

### Run it locally

```bash
cd contracts/token && cargo test          # 14 unit tests, one or more per rule
cd web && npm install && npm run dev      # http://localhost:3000, against the live testnet contracts
```

No env vars are needed for reads, wallet connection, launches, trades or wallet rug attempts. The no-wallet rug lab needs `SANDBOX_KEY`. Full instructions, including how to deploy your own factory, are in [docs/SETUP.md](docs/SETUP.md).

## NEAR tech used

- **Own Rust contracts on NEAR** (near-sdk 5.30, cargo-near). The token is NEP-141 (`ft_transfer`, `ft_transfer_call`, metadata) and NEP-145-lite storage, plus an in-contract constant-product bonding curve. It emits NEP-297 events and keeps a 64-entry on-chain event ring.
- **Global contracts.** The token wasm is stored once by hash (`B4tk97kL…`). Each launch uses `UseGlobalContract`, so a launch costs about 0.3 NEAR of state instead of a full code deploy.
- **Sub-accounts, created by a factory.** `tripwire.testnet` creates `<symbol>.tripwire.testnet` in one batched promise (CreateAccount, Transfer, UseGlobalContract, FunctionCall `new`) with a refund callback.
- **Keyless accounts.** No `AddKey` is ever issued, so "renounced" is something anyone can check (`list-keys` is empty).
- **Named, readable panics** (`TRIPWIRE[RULE]`), parsed from failed receipts through the FastNEAR RPC and the FastNEAR tx indexer.
- **NEAR Wallet Selector** (Intear, Meteor, HOT, Sender) and **near-api-js** for signing. The no-wallet sandbox signs server-side with a testnet key held only in an env var.

## Architecture

```
 creator wallet ──launch(rules) + 0.3 Ⓝ──▶ tripwire.testnet (factory)
                                              │ CreateAccount  <sym>.tripwire.testnet
                                              │ UseGlobalContract(hash)   ← no AddKey, ever
                                              │ FunctionCall   new(creator, rules, …)
                                              ▼
 traders / attackers ──buy · sell · ft_*──▶ <sym>.tripwire.testnet (token)
                                              ├─ ok      → state change + NEP-297 log + event ring
                                              └─ rule ✕  → panic "TRIPWIRE[RULE] …" (tx fails, nothing moves)
```

More detail is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

| Thing | Where |
|---|---|
| Factory | [`tripwire.testnet`](https://testnet.nearblocks.io/address/tripwire.testnet) |
| Token code (global, by hash) | `B4tk97kLWUVMVfPYXcLvAqxTr9viJAeFaaEhqHqPYY3c` |
| Demo token | [`grug.tripwire.testnet`](https://testnet.nearblocks.io/address/grug.tripwire.testnet) ($GRUG, creator `tripwire-ops.testnet`) |
| A blocked mint | [`7Y5xZj1C…`](https://testnet.nearblocks.io/txns/7Y5xZj1Ci24T9jE4YaUuLntR9iUWx2hNUf8Fcdg8r3CD): `TRIPWIRE[FIXED_SUPPLY] supply is fixed at 1,000,000,000 forever…` |
| A blocked liquidity pull | [`B37X2Ur6…`](https://testnet.nearblocks.io/txns/B37X2Ur6k98uQS9T1qTHRatcYQM6JuVQXzzYzwjrzP6c): `TRIPWIRE[LIQUIDITY_LOCK] …` |

## Repo layout

```
contracts/token     NEP-141 token + bonding curve + the ten rules (Rust, near-sdk 5)
contracts/factory   launches tokens on keyless sub-accounts from global code
web                 Next.js 15 app (wallet selector, rug lab, audit feed)
docs                ARCHITECTURE.md, RULES.md, SETUP.md
shots               screenshots of the live app
```

## Libraries, templates and AI use

- Rust: `near-sdk` 5.30, `cargo-near`.
- Web: Next.js 15, React 19, Tailwind CSS 4, Motion, `near-api-js`, `@near-wallet-selector/*` (Intear, Meteor, HOT, Sender, MyNearWallet modules).
- Infra: FastNEAR testnet RPC and tx indexer, Vercel hosting.
- No starter template was used. AI coding assistants helped write the code and docs, as the rules allow (Q-005).

## Hackathon timeline

All code in this repository was written during the NEAR HACKATHON window (from 2026-11-01). There is no pre-hackathon baseline and no earlier product on another chain.

One builder, two independent entries, as the rules allow (Q-015).

## License

MIT. See [LICENSE](LICENSE).
