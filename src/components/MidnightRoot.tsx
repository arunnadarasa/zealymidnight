import { lazy, Suspense, type ReactNode } from "react";
import { ClientOnly } from "./ClientOnly";

const MidnightWalletEntry = lazy(() => import("./midnight-wallet-entry"));

export function MidnightRoot({ children }: { children: ReactNode }) {
  return (
    <ClientOnly fallback={children}>
      <Suspense fallback={children}>
        <MidnightWalletEntry>{children}</MidnightWalletEntry>
      </Suspense>
    </ClientOnly>
  );
}

/** @deprecated Privy removed — use MidnightRoot */
export const PrivyRoot = MidnightRoot;
