import type { TokenKey } from "@/lib/tokens";
import { INDEXER_URL, txExplorerUrl } from "@/lib/tokens";

export interface SettleResult {
  hash: `0x${string}` | string;
  from: string;
  to: string;
  token: TokenKey;
  atomic: string;
  explorer: string;
  simulated?: boolean;
  network?: string;
  nonce?: string;
  paymentSignature?: string;
}

/**
 * Settle H2H / H2A / A2A on Midnight Undeployed via genesis server-append (mUSDC).
 * Lace cannot sign on Undeployed — the server uses the genesis wallet.
 */
export async function settleOnMidnight(
  _wallet: { address?: string } | null | undefined,
  token: TokenKey,
  _to: string,
  atomic: bigint,
  memo?: string,
): Promise<SettleResult> {
  // Ensure faucet balance once per session (best-effort).
  try {
    await fetch("/api/public/musdc-faucet", { method: "POST" });
  } catch {
    /* already claimed or stack down */
  }

  const res = await fetch("/api/public/musdc-transfer", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      amountAtomic: atomic.toString(),
      memo: memo ?? `streetrail-settle:${token}`,
    }),
  });
  const body = (await res.json()) as {
    midnightTxHash?: string;
    fromPk?: string;
    toPk?: string;
    amount?: string;
    error?: string;
    simulated?: boolean;
    network?: string;
  };
  if (!res.ok) {
    throw new Error(body.error || `mUSDC settle failed (${res.status})`);
  }
  const hash = body.midnightTxHash || "";
  return {
    hash,
    from: body.fromPk || "genesis",
    to: body.toPk || "treasury",
    token,
    atomic: body.amount || atomic.toString(),
    explorer: txExplorerUrl(hash),
    simulated: body.simulated,
    network: body.network || "undeployed",
  };
}

/** @deprecated alias — Arc settlement replaced by Midnight Undeployed mUSDC */
export const settleOnArc = settleOnMidnight;

export function settlementNote(token: TokenKey): string {
  return `Settles as experimental mUSDC on Midnight Undeployed (priced as ${token}). Indexer: ${INDEXER_URL}`;
}
