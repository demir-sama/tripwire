<p align="center"><img src="web/public/icon.svg" width="72" alt="Tripwire"></p>

<h1 align="center">Tripwire</h1>
<p align="center"><b>Meme tokens with rules.</b> Buy and sell limits, max wallet, creator fee, vesting and a liquidity lock, enforced by a NEAR contract. Try to rug one and the transaction fails on-chain with the rule's name in the error.</p>

<p align="center">
  <a href="https://tripwire-sama-5806.vercel.app">Live app</a> ·
  <a href="https://tripwire-sama-5806.vercel.app/t/GRUG#rug">Rug lab</a> ·
  <a href="docs/ARCHITECTURE.md">Architecture</a> ·
  <a href="docs/RULES.md">Rules</a> ·
  <a href="docs/SETUP.md">Setup</a>
</p>

> Built at **NEAR HACKATHON** (Nov 2026), track **Memecoins With Mechanics**. Testnet only. Not audited.

## What it is

Meme coins usually die in a few predictable ways: the dev dumps the team bag, mints more, raises the tax, or pulls the liquidity. Every one of those starts with a promise like "LP is locked" that holders can't check.

Tripwire replaces the promise with code:

- **Launch form.** Pick a name, a symbol and a rule set (Fortress, Balanced, Loose but safe, or custom). One transaction to the factory creates `<symbol>.tripwire.testnet`. It runs pinned global contract code and has **zero access keys**, so no one can redeploy it.
- **Token page.** Live rule status read from chain, price and curve stats, buy and sell with pre-flight warnings ("this will trip MAX_WALLET"), creator tools, and an audit feed that merges on-chain events with **failed transactions** parsed for their `TRIPWIRE[RULE]` code.
- **Rug lab.** Nine rug attempts (dump the vesting bag, giant sell, mint, raise the fee, pull the liquidity, rewrite rules, hand off ownership, swap the code, snipe the curve). Fire them as the real creator of `$GRUG` with no wallet (a server key signs), or with your own wallet against any token. Every attempt is a real testnet transaction that fails and names the rule.

## The ten rules

| # | Code | The usual promise | What the contract does |
|---|------|-------------------|------------------------|
| 01 | `FIXED_SUPPLY` | "We'll never mint more" | No mint path. `mint()` always panics. |
| 02 | `LIQUIDITY_LOCK` | "LP is locked" | Curve NEAR lives in the token contract and only leaves through sells. `withdraw_liquidity()` always panics. |
| 03 | `VESTING_LOCK` | "Team tokens are vested" | Creator allocation unlocks linearly. Selling or transferring locked tokens panics. |
| 04 | `MAX_SELL` | "We won't dump" | Every sell is capped at a share of supply. |
| 05 | `MAX_BUY` | "Fair launch" | Every buy is capped; the deposit is refunded when it trips. |
| 06 | `MAX_WALLET` | "No whales" | Buys and transfers that would push a wallet over the cap panic. |
| 07 | `FEE_RATCHET` | "Fees stay low" | The creator fee can only go down. |
| 08 | `SELL_COOLDOWN` | "No bot dumps" | One sell per wallet per cooldown window. |
| 09 | `IMMUTABLE_RULES` | "We won't change the rules" | No rule setter; the creator role can't be handed off. |
| 10 | `IMMUTABLE_CODE` | "Contract is renounced" | Token accounts have zero keys and no upgrade method. |

Bounds, error formats and examples: [docs/RULES.md](docs/RULES.md).

## Live on NEAR testnet

| Thing | Where |
|---|---|
| Factory | [`tripwire.testnet`](https://testnet.nearblocks.io/address/tripwire.testnet) |
| Token code (global, by hash) | `B4tk97kLWUVMVfPYXcLvAqxTr9viJAeFaaEhqHqPYY3c` |
| Demo token | [`grug.tripwire.testnet`](https://testnet.nearblocks.io/address/grug.tripwire.testnet) ($GRUG, creator `tripwire-ops.testnet`) |
| A blocked mint | [`7Y5xZj1C…`](https://testnet.nearblocks.io/txns/7Y5xZj1Ci24T9jE4YaUuLntR9iUWx2hNUf8Fcdg8r3CD): `TRIPWIRE[FIXED_SUPPLY] supply is fixed at 1,000,000,000 forever…` |

## Repo layout

```
contracts/token     NEP-141 token + bonding curve + rules (Rust, near-sdk 5)
contracts/factory   launches tokens on keyless sub-accounts from global code
web                 Next.js 15 app (wallet selector, rug lab, audit feed)
docs                ARCHITECTURE.md, RULES.md, SETUP.md
```

## Quick start

```bash
cd contracts/token && cargo test          # 14 unit tests
cd web && npm install && npm run dev      # app against the live testnet contracts
```

Full instructions, including deploying your own factory: [docs/SETUP.md](docs/SETUP.md).

## Stack

Rust + near-sdk 5.30 + cargo-near · NEAR global contracts · Next.js 15 · Tailwind 4 · Motion · NEAR Wallet Selector (Intear, Meteor, HOT, Sender) · near-api-js · FastNEAR RPC and tx indexer.

## Hackathon note

One builder, two entries, as allowed by the rules. My other NEAR HACKATHON project is **Hesitate** ([repo](https://github.com/demir-sama/hesitate) · [live](https://hesitate-sama-5806.vercel.app)), in the AI Security & Defense track.

## License

MIT. See [LICENSE](LICENSE).
