import { createServerFn } from "@tanstack/react-start";
import { INDEXER_URL } from "@/lib/tokens";

/**
 * Confirmation state for settlement hashes, read from the local Midnight
 * indexer GraphQL API. Undeployed mUSDC / MoveNft hashes are
 * HexEncoded ledger ids — 32-byte `hash` or 33-byte `identifier` (00-prefixed).
 */

type TxStatusResult = { hash: string; status: "pending" | "success" | "failed" };

function normalizeHex(raw: string): string {
  const s = raw.trim().replace(/^0x/i, "").toLowerCase();
  return /^[0-9a-f]+$/.test(s) ? s : "";
}

function isLookupable(hex: string): boolean {
  return hex.length === 64 || hex.length === 66;
}

async function lookupIndexer(hex: string): Promise<"success" | "pending" | "failed"> {
  const offsetField = hex.length === 66 ? "identifier" : "hash";
  const query = `query($h: HexEncoded!) {
    transactions(offset: { ${offsetField}: $h }) {
      hash
      id
      block { height }
    }
  }`;
  try {
    const res = await fetch(INDEXER_URL, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ query, variables: { h: hex } }),
    });
    if (!res.ok) return "pending";
    const json = (await res.json()) as {
      data?: { transactions?: Array<{ hash?: string; id?: number }> | null };
      errors?: Array<{ message?: string }>;
    };
    if (json.errors?.length) return "pending";
    const rows = json.data?.transactions ?? [];
    if (rows.length > 0) return "success";
    return "pending";
  } catch {
    return "pending";
  }
}

export const fetchTxStatuses = createServerFn({ method: "POST" })
  .inputValidator((data: { hashes: string[] }) => ({
    hashes: (data?.hashes ?? [])
      .map((h) => String(h ?? ""))
      .filter((h) => isLookupable(normalizeHex(h)))
      .slice(0, 25),
  }))
  .handler(async ({ data }): Promise<{ results: TxStatusResult[] }> => {
    const results = await Promise.all(
      data.hashes.map(async (hash) => {
        const hex = normalizeHex(hash);
        const status = await lookupIndexer(hex);
        return { hash, status };
      }),
    );
    return { results };
  });
