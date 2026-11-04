import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { Account, JsonRpcProvider, teraToGas, baseEncode, encodeTransaction, type KeyPairString } from "near-api-js";
import { actionCreators } from "@near-js/transactions";
import { SANDBOX_ACTIONS } from "@/lib/sandbox";
import { parseTrip } from "@/lib/rules";
import { RPC, SANDBOX_CREATOR, SANDBOX_SYMBOL, tokenAccount, toString } from "@/lib/sandbox-config";

const last = new Map<string, number>();

export async function POST(req: NextRequest) {
  const key = process.env.SANDBOX_KEY;
  if (!key) return NextResponse.json({ error: "Sandbox signer is not configured on this deployment." }, { status: 503 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "local";
  if (Date.now() - (last.get(ip) ?? 0) < 3500) return NextResponse.json({ error: "Easy, one attempt every few seconds." }, { status: 429 });
  last.set(ip, Date.now());
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  const a = SANDBOX_ACTIONS.find((x) => x.id === action);
  if (!a) return NextResponse.json({ error: "unknown action" }, { status: 400 });
  const provider = new JsonRpcProvider({ url: RPC });
  const acct = new Account(SANDBOX_CREATOR, provider, key as KeyPairString);
  const deposit = a.depositNear ? toString(a.depositNear) : 0n;
  let hash: string | null = null;
  try {
    const action = actionCreators.functionCall(a.method, a.args, teraToGas("60"), deposit);
    const signed = await acct.createSignedTransaction({ receiverId: tokenAccount(SANDBOX_SYMBOL), actions: [action] } as any);
    // Hash is known before broadcast, so a blocked tx can always be linked.
    hash = baseEncode(createHash("sha256").update(encodeTransaction(signed.transaction)).digest());
    const r: any = await provider.sendTransactionUntil(signed, "EXECUTED_OPTIMISTIC");
    const failure = r.status?.Failure ?? r.receipts_outcome?.find((x: any) => x.outcome?.status?.Failure)?.outcome?.status?.Failure;
    if (failure) return NextResponse.json({ hash, blocked: true, ...(parseTrip(JSON.stringify(failure)) ?? { rule: "UNKNOWN", message: JSON.stringify(failure).slice(0, 200) }) });
    return NextResponse.json({ hash, blocked: false });
  } catch (e: any) {
    const s = JSON.stringify(e?.data ?? e?.cause ?? {}) + " " + String(e?.message ?? e);
    const p = parseTrip(s);
    if (p) return NextResponse.json({ hash, blocked: true, ...p });
    return NextResponse.json({ error: String(e?.message ?? e).slice(0, 300) }, { status: 502 });
  }
}
