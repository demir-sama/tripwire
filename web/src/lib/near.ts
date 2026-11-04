import { RPC } from "./config";

async function rpc<T>(method: string, params: unknown): Promise<T> {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: "tw", method, params }),
    cache: "no-store",
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error?.cause?.name || j.error?.message || "RPC error");
  if (j.result?.error) throw new Error(j.result.error);
  return j.result as T;
}

export async function view<T>(contract: string, method: string, args: Record<string, unknown> = {}): Promise<T> {
  const b64 = typeof window === "undefined" ? Buffer.from(JSON.stringify(args)).toString("base64") : btoa(JSON.stringify(args));
  const res = await rpc<{ result: number[] }>("query", { request_type: "call_function", finality: "optimistic", account_id: contract, method_name: method, args_base64: b64 });
  return JSON.parse(new TextDecoder().decode(new Uint8Array(res.result))) as T;
}

export type AccountView = { amount: string; storage_usage: number; code_hash: string; global_contract_hash?: string };
export const viewAccount = (account_id: string) => rpc<AccountView>("query", { request_type: "view_account", finality: "final", account_id });
export const accessKeys = (account_id: string) =>
  rpc<{ keys: { public_key: string }[] }>("query", { request_type: "view_access_key_list", finality: "final", account_id }).then((r) => r.keys);
