# Architecture

```
 creator wallet ──launch(rules) + 0.3 Ⓝ──▶ tripwire.testnet (factory)
                                              │ CreateAccount  <sym>.tripwire.testnet
                                              │ Transfer       0.3 Ⓝ (storage)
                                              │ UseGlobalContract(hash)   ← no AddKey, ever
                                              │ FunctionCall   new(creator, rules, …)
                                              ▼
 traders / attackers ──buy · sell · ft_*──▶ <sym>.tripwire.testnet (token)
                                              ├─ ok      → state change + NEP-297 log + event ring
                                              └─ rule ✕  → panic "TRIPWIRE[RULE] …" (tx fails, nothing moves)
```

## Contracts

### Factory: `contracts/factory` → `tripwire.testnet`
- `launch(name, symbol, tagline, icon, supply_whole, rules)` (payable, ≥ 0.3 NEAR). Validates the symbol (`A-Z0-9`, 2–10 chars), builds one batched promise to `<symbol lowercased>.tripwire.testnet`, then calls `on_launch`. That callback records the token, or refunds the deposit if creation failed (for example, the symbol was taken).
- `tokens(from, limit)` returns newest first. Also `token(symbol)` and `config()`.
- `set_token_code_hash(hash)` is owner only and changes the code used for **future** launches. A launched token keeps the hash it was created with. It has no keys, so nobody can point it at new code.

### Token: `contracts/token` (global contract `B4tk97kLWUVMVfPYXcLvAqxTr9viJAeFaaEhqHqPYY3c`)
- **NEP-141:** `ft_transfer`, `ft_transfer_call` + `ft_resolve_transfer`, `ft_total_supply`, `ft_balance_of`, `ft_metadata` (18 decimals). **NEP-145 (lite):** `storage_deposit`, `storage_balance_of`, `storage_balance_bounds`. A buy auto-registers the buyer for 0.00125 NEAR.
- **Market:** a constant-product bonding curve inside the token. The reserve is `virtual_near (30 Ⓝ) + curve_near` against the unsold token inventory. Prices use 256-bit `mul_div` to avoid overflow. The creator fee is taken in NEAR on both sides and accrues to `creator_fees` (`claim_fees()`).
- **Methods:** `buy(min_tokens_out)`, `sell(amount, min_near_out)` (1 yocto), `claim_fees()`, `set_fee(lower)`.
- **Rug vectors that always fail:** `mint`, `withdraw_liquidity`, `set_rules`, `transfer_ownership`, `upgrade`. They exist so an attempt produces a clear, named failure instead of "method not found".
- **Views:** `tripwire_info`, `wallet_status(account)` (balance, locked, room under max wallet, next sell time), `quote_buy`, `quote_sell`, `events(limit)`.
- **Audit trail:** each successful action emits a NEP-297 log and writes to a 64-entry on-chain ring buffer of events.

### Why global contracts + keyless accounts
- **Cheap launches:** the ~217 KB wasm is stored once as a global contract. Each token pays only for its own state, about 0.3 NEAR.
- **Provable immutability:** "renounced" is checkable. The account has no keys, so `list-keys` is empty, and the code is a hash reference anyone can verify. The app shows the live key count on every token page.

## Web app: `web/` (Next.js 15, App Router)

| Route | What |
|---|---|
| `/` | Hero with pluckable wire, live stats, promises vs code, live token list |
| `/launch` | Rule presets and sliders, live preview, symbol availability, `launch` tx |
| `/t/[symbol]` | Header, stats, rule board (armed / trip counters), trade panel with pre-flight rule checks, creator tools, rug lab, audit feed |
| `/about` | Story, architecture, rulebook, FAQ |
| `/api/trips` | Blocked attempts for an account: failed txs parsed for `TRIPWIRE[RULE]` |
| `/api/sandbox` | Signs one of nine rug attempts as `$GRUG`'s creator with a server-held testnet key. Rate limited. |

**Reads** are direct JSON-RPC `call_function` views (FastNEAR testnet RPC), polled every 6 s on token pages.

**Writes** go through NEAR Wallet Selector (Intear, Meteor, HOT, Sender). Calls are built with `actionCreators.functionCall`. Wallets often hide the hash of a failed tx, so when a call throws, the app looks up the signer's latest tx to that token through the indexer and links it.

**Blocked-attempt feed.** A reverted transaction can't write state, so blocked attempts can't live in the contract's event log. `/api/trips` asks the FastNEAR tx indexer (`tx.test.fastnear.com`) for the account's transactions, fetches the failed ones, and parses the receipt's `FunctionCallError` panic for the rule code. Indexer lag is about 10–20 s.

**Sandbox signer.** It signs the transaction locally, so the tx hash is known before broadcast and every blocked attempt links to its failed tx. The key (`SANDBOX_KEY`) exists only as a server env var. That account holds a few testnet NEAR and controls nothing except its own `$GRUG` creator bag, which is exactly what the rules lock.

## Trust boundaries
- The factory owner can change the code hash for *future* launches only.
- The frontend is convenience. Every guarantee is in the token contract, and every claim on screen is read from chain.
- Not audited, testnet only.
