import { NextRequest, NextResponse } from "next/server";
import { tripsFor, tripByHash, latestFrom } from "@/lib/trips.server";

const ACCT = /^[a-z0-9._-]{2,64}$/;

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  try {
    const hash = p.get("hash");
    if (hash) {
      if (!/^[1-9A-HJ-NP-Za-km-z]{32,64}$/.test(hash)) return NextResponse.json({ error: "bad hash" }, { status: 400 });
      return NextResponse.json({ trip: await tripByHash(hash) });
    }
    const signer = p.get("signer");
    const account = p.get("account") ?? "";
    if (!ACCT.test(account)) return NextResponse.json({ error: "bad account" }, { status: 400 });
    if (signer) {
      if (!ACCT.test(signer)) return NextResponse.json({ error: "bad signer" }, { status: 400 });
      return NextResponse.json({ latest: await latestFrom(signer, account, Number(p.get("since") || Date.now() - 120000)) });
    }
    return NextResponse.json({ trips: await tripsFor(account) });
  } catch (e) {
    return NextResponse.json({ trips: [], error: (e as Error).message }, { status: 200 });
  }
}
