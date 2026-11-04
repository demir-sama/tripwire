"use client";
import { useEffect, useState } from "react";
import { view } from "./near";
import { FACTORY } from "./config";
import type { Info, TokenEntry, Trip } from "./types";

export type TokenRow = TokenEntry & { info?: Info; trips?: number };

export function useTokens() {
  const [rows, setRows] = useState<TokenRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let off = false;
    (async () => {
      try {
        const list = await view<TokenEntry[]>(FACTORY, "tokens", { limit: 60 });
        if (off) return;
        setRows(list);
        const full = await Promise.all(list.map(async (t) => {
          const [info, trips] = await Promise.all([
            view<Info>(t.account_id, "tripwire_info").catch(() => undefined),
            fetch(`/api/trips?account=${t.account_id}`).then((r) => r.json()).then((j: { trips: Trip[] }) => j.trips?.length ?? 0).catch(() => 0),
          ]);
          return { ...t, info, trips };
        }));
        if (!off) setRows(full);
      } catch (e) { if (!off) setError((e as Error).message); }
    })();
    return () => { off = true; };
  }, []);
  return { rows, error };
}
