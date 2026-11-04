# Setup

## Prerequisites
- Rust (stable) with the `wasm32-unknown-unknown` target, and [`cargo-near`](https://github.com/near/cargo-near) ≥ 0.22
- [`near-cli-rs`](https://github.com/near/near-cli-rs) ≥ 0.30
- Node 20+

## 1. Test the contracts
```bash
cd contracts/token && cargo test
```

## 2. Run the app against the live testnet deployment
```bash
cd web
npm install
npm run dev            # http://localhost:3000
```
Reads, wallet connection, launches, trades and wallet rug attempts all work without any env vars. The no-wallet sandbox in the rug lab needs `SANDBOX_KEY` (step 4).

You need a funded testnet account in a wallet. [Intear Wallet](https://wallet.intear.tech) imports testnet accounts by private key or seed phrase, and the [faucet](https://near-faucet.io) gives free test NEAR. (MyNearWallet stopped app connections in Nov 2026.)

## 3. Deploy your own factory (optional)
```bash
# build
(cd contracts/token && cargo near build non-reproducible-wasm)
(cd contracts/factory && cargo near build non-reproducible-wasm)

# store the token code once as a global contract, by hash (~22 testnet NEAR of storage)
near contract deploy-as-global use-file contracts/token/target/near/tripwire_token.wasm \
  as-global-hash <your-factory>.testnet network-config testnet sign-with-keychain send

# deploy and init the factory
near contract deploy <your-factory>.testnet use-file contracts/factory/target/near/tripwire_factory.wasm \
  with-init-call new json-args '{"owner":"<your-factory>.testnet","token_code_hash":"<hash>"}' \
  prepaid-gas '30 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-keychain send
```
Then set `FACTORY` and `TOKEN_CODE_HASH` in `web/src/lib/config.ts`.

Launch a token from the CLI:
```bash
near contract call-function as-transaction <your-factory>.testnet launch json-args '{
  "name":"Grug Who Cannot Rug","symbol":"GRUG","tagline":"grug make coin.","icon":null,"supply_whole":"1000000000",
  "rules":{"max_buy_bps":100,"max_sell_bps":50,"max_wallet_bps":200,"fee_bps":100,"sell_cooldown_sec":60,"creator_alloc_bps":500,"creator_vest_days":30}
}' prepaid-gas '150 Tgas' attached-deposit '0.3 NEAR' sign-as <creator>.testnet network-config testnet sign-with-keychain send
```

## 4. Environment variables (web)
| Var | Required | Purpose |
|---|---|---|
| `SANDBOX_KEY` | for the no-wallet rug lab | `ed25519:…` private key of the sandbox token's creator (`SANDBOX_CREATOR` in `src/lib/config.ts`). Server-only. **Never commit it.** |
| `NEXT_PUBLIC_SITE_URL` | no | Canonical URL for metadata |
| `FASTNEAR_TX_API` | no | Override the tx indexer (default `https://tx.test.fastnear.com`) |

Put them in `web/.env.local` (git-ignored) or your host's env settings.

## 5. Deploy the web app (Vercel)
Set the project root to `web`, add the env vars, and deploy. No other configuration is needed.
