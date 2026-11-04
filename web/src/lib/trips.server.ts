import "server-only";
import type { Trip } from "./types";
import { parseTrip } from "./rules";

const TX_API = process.env.FASTNEAR_TX_API || "https://tx.test.fastnear.com";
type AccountTx = { transaction_hash: string; tx_block_timestamp: string; is_success: boolean; is_receiver: boolean; is_signer: boolean };

const cache = new Map<string, { at: number; data: Trip[] }>();
const txCache = new Map<string, Trip | null>();

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${TX_API}${path}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store" });
  if (!r.ok) throw new Error(`tx api ${r.status}`);
  return r.json() as Promise<T>;
}

function decodeTrip(t: any): Trip | null {
  const tx = t.transaction;
  const call = tx.actions?.find((a: any) => a.FunctionCall)?.FunctionCall;
  for (const r of t.receipts ?? []) {
    const st = r.execution_outcome?.outcome?.status;
    if (st?.Failure) {
      const p = parseTrip(JSON.stringify(st.Failure));
      if (!p) continue;
      return { hash: tx.hash, signer: tx.signer_id, method: call?.method_name ?? "?", rule: p.rule, message: p.message, ts_ms: Math.floor(Number(r.execution_outcome.block_timestamp) / 1e6) };
    }
  }
  return null;
}

/** Failed transactions against `account` whose panic carries a TRIPWIRE[RULE] code. */
export async function tripsFor(account: string, limit = 40): Promise<Trip[]> {
  const hit = cache.get(account);
  if (hit && Date.now() - hit.at < 6000) return hit.data;
  const { account_txs } = await post<{ account_txs: AccountTx[] }>("/v0/account", { account_id: account, is_real_receiver: true, limit: 200 });
  const failed = account_txs.filter((t) => !t.is_success).slice(0, limit).map((t) => t.transaction_hash);
  const unknown = failed.filter((h) => !txCache.has(h));
  for (let i = 0; i < unknown.length; i += 20) {
    const { transactions } = await post<{ transactions: any[] }>("/v0/transactions", { tx_hashes: unknown.slice(i, i + 20) });
    for (const t of transactions ?? []) if (t) txCache.set(t.transaction.hash, decodeTrip(t));
  }
  const data = failed.map((h) => txCache.get(h)).filter((x): x is Trip => !!x && !x.rule.startsWith("ERR_"));
  cache.set(account, { at: Date.now(), data });
  return data;
}

/** Look up one transaction (used right after a wallet reports a failure). */
export async function tripByHash(hash: string): Promise<Trip | null> {
  if (txCache.get(hash)) return txCache.get(hash)!;
  const { transactions } = await post<{ transactions: any[] }>("/v0/transactions", { tx_hashes: [hash] });
  const t = transactions?.[0];
  const d = t ? decodeTrip(t) : null;
  if (t) txCache.set(hash, d);
  return d;
}

/** Most recent tx from `signer` to `receiver` (fallback when a wallet hides the hash on failure). */
export async function latestFrom(signer: string, receiver: string, sinceMs: number): Promise<Trip | { hash: string; ok: true } | null> {
  const { account_txs } = await post<{ account_txs: AccountTx[] }>("/v0/account", { account_id: signer, limit: 10 });
  for (const a of account_txs) {
    if (Number(a.tx_block_timestamp) / 1e6 < sinceMs - 5000) break;
    const { transactions } = await post<{ transactions: any[] }>("/v0/transactions", { tx_hashes: [a.transaction_hash] });
    const t = transactions?.[0];
    if (!t || t.transaction.receiver_id !== receiver) continue;
    return decodeTrip(t) ?? { hash: a.transaction_hash, ok: true };
  }
  return null;
}
