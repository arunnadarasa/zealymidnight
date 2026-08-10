import { useState } from "react";

/** Midnight Undeployed tip card (Circle Arc treasury is out of path). */
export function TreasuryCard({ address }: { address?: string }) {
  const [copied, setCopied] = useState(false);
  const label = address?.trim() || "streetrail:treasury:v1";

  return (
    <div className="rounded-2xl border border-border bg-linear-to-br from-surface to-surface-2 p-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">Midnight Undeployed</p>
      <p className="mt-2 text-sm text-foreground">
        Writes use genesis <strong>server-append</strong> (Lace cannot sign on Undeployed). Local stack: node{" "}
        <code className="rounded bg-background/50 px-1">:9944</code>, indexer{" "}
        <code className="rounded bg-background/50 px-1">:8088</code>, proof server{" "}
        <code className="rounded bg-background/50 px-1">:6300</code>.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 break-all rounded bg-background/50 px-2 py-1 text-xs text-foreground/85 sm:text-sm">
          {label}
        </code>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(label);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/85"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Keep Docker up, then <code className="rounded bg-secondary px-1.5 py-0.5 text-glow">bun run midnight:deploy</code>{" "}
        after Compact changes. Optional clip pins need <code className="rounded bg-secondary px-1.5 py-0.5">PINATA_JWT</code>.
      </p>
    </div>
  );
}
