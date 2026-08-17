// Worker-safe Circle rail status adapters.
//
// Circle's App Kit packages currently pull Solana's Anchor SDK into the server
// bundle. Anchor executes CommonJS-only `exports.*` code during Worker startup,
// taking down every SSR route. StreetRail settles on Midnight, so these optional
// cross-chain SDK features report a graceful fallback instead of importing the
// incompatible packages.

export interface UnifiedBalanceResult {
  available: boolean;
  address: string | null;
  totalUsdc: string | null;
  chains: { chain: string; amount: string }[];
  reason?: string;
}

export interface SwapRatesResult {
  available: boolean;
  source: "circle-swap-kit" | "fx-fallback";
  rates: { token: string; usd: number }[];
  supportedChains: string[];
  reason?: string;
}

export async function unifiedBalance(address?: string): Promise<UnifiedBalanceResult> {
  const addr = address ?? process.env["CIRCLE_TREASURY_ADDRESS"] ?? null;
  return {
    available: false,
    address: addr,
    totalUsdc: null,
    chains: [],
    reason: addr ? "cross_chain_sdk_unavailable_on_worker" : "no_treasury_address",
  };
}

export async function swapRates(fxUsdRates: { token: string; usd: number }[]): Promise<SwapRatesResult> {
  return {
    available: false,
    source: "fx-fallback",
    rates: fxUsdRates,
    supportedChains: ["arcTestnet"],
    reason: "cross_chain_sdk_unavailable_on_worker",
  };
}

/**
 * Gas / sponsorship status for agent rails.
 * On Midnight Undeployed, settlement uses genesis server-append + local proofs.
 */
export function gasStationStatus() {
  const policyId = process.env["CIRCLE_GAS_STATION_POLICY_ID"] ?? null;
  return {
    product: "Local proof server",
    enabled: Boolean(policyId),
    policyId: policyId ? `${policyId.slice(0, 8)}…` : null,
    note: policyId
      ? "Optional gas policy attached — Undeployed settle still uses mUSDC server-append."
      : "Undeployed settles with genesis server-append and the local proof server — no EVM gas station.",
  };
}
