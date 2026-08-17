import { defineChain } from "viem";

// CRITICAL: nativeCurrency.decimals = 6 because USDC is the gas token on this EVM testnet.
// Using 18 (the default EVM assumption) will corrupt every balance/fee display by 10^12.
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Legacy EVM testnet",
  network: "arc-testnet",
  nativeCurrency: { name: "USD Coin", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: {
      // Same-origin proxy: keeps the upstream provider key (Alchemy) server-side.
      http: ["/api/public/arc-rpc"],
    },
  },
  blockExplorers: {
    default: { name: "Block explorer", url: "https://testnet.arcscan.app" },
  },
});
