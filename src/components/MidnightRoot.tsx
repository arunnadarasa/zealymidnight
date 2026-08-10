import type { ReactNode } from "react";
import MidnightWalletEntry from "./midnight-wallet-entry";
import { ClientOnly } from "./ClientOnly";
import { UNDEPLOYED_WALLET_BOOTSTRAP, WalletContext } from "@/lib/wallet-context";

/**
 * Lace / Undeployed wallet root.
 * ClientOnly still avoids SSR window access inside the Lace hook, but the
 * fallback MUST provide WalletContext (available: true) — otherwise Header
 * falls through to WALLET_UNAVAILABLE and shows the stale Privy badge.
 */
export function MidnightRoot({ children }: { children: ReactNode }) {
  return (
    <ClientOnly
      fallback={
        <WalletContext.Provider value={UNDEPLOYED_WALLET_BOOTSTRAP}>{children}</WalletContext.Provider>
      }
    >
      <MidnightWalletEntry>{children}</MidnightWalletEntry>
    </ClientOnly>
  );
}

/** @deprecated Privy removed — use MidnightRoot */
export const PrivyRoot = MidnightRoot;
