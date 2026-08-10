import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getCircleRails } from "@/lib/circle-rails.functions";
import { getAuthorizer } from "@/lib/erc1271.functions";

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <li className="rounded-xl border border-border/70 bg-background/40 px-4 py-3 backdrop-blur">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-black tracking-wide text-foreground">{label}</span>
        <span className="text-[11px] font-semibold text-glow">{value}</span>
      </div>
      {hint ? <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{hint}</p> : null}
    </li>
  );
}

/**
 * Undeployed settle-stack status for agent flows (x402 / mUSDC / indexer).
 */
export function CircleRailsPanel() {
  const fetchRails = useServerFn(getCircleRails);
  const fetchAuthorizer = useServerFn(getAuthorizer);
  const { data: auth } = useQuery({
    queryKey: ["erc1271-authorizer"],
    queryFn: () => fetchAuthorizer(),
    staleTime: 5 * 60 * 1000,
  });
  const { data, isLoading } = useQuery({
    queryKey: ["midnight-rails"],
    queryFn: () => fetchRails(),
    staleTime: 5 * 60 * 1000,
  });

  return (
    <section className="rounded-3xl border border-border/70 bg-surface/60 p-5 sm:p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-black uppercase tracking-[0.18em] text-foreground">
          Midnight Undeployed rails
        </h3>
        <span className="text-[11px] text-muted-foreground">
          mUSDC · x402 · AP2 · indexer
        </span>
      </header>

      {isLoading || !data ? (
        <p className="mt-4 text-xs text-muted-foreground">Reading Undeployed rails…</p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          <Row
            label="ERC-1271 authorization"
            value={auth ? (auth.reachable ? "live" : "off-chain only") : "checking…"}
            hint={
              auth
                ? `Contract wallet ${auth.authorizer.slice(0, 10)}… authorizes gateway digests via isValidSignature when configured.`
                : "Reading the on-chain authorizer…"
            }
          />
          <Row
            label="Nanopayments"
            value={data.nanopay.available ? "batched" : "fallback"}
            hint={
              data.nanopay.available
                ? `Gateway balance ${data.nanopay.gatewayUsdc} · agent ${data.nanopay.agentAddress?.slice(0, 8)}…`
                : "Gateway batching unfunded — settlement falls back to experimental mUSDC on Midnight Undeployed."
            }
          />
          <Row
            label="Agent discovery"
            value={`${data.discovery.total} resources`}
            hint={
              data.discovery.source === "circle"
                ? `External x402 catalog · ${data.discovery.arcCount} resources (demo settles on Midnight Undeployed)`
                : "External catalog unreachable — using StreetRail's own x402 / mUSDC resource."
            }
          />
          <Row
            label="Unified balance"
            value={data.balance.available ? `${data.balance.totalUsdc} USDC` : "treasury"}
            hint={
              data.balance.address
                ? `Treasury ${data.balance.address.slice(0, 10)}… — FX keys still price EUR/BTC; settle is mUSDC.`
                : "No treasury address configured for this Undeployed demo."
            }
          />
          <Row
            label="FX rates"
            value="live FX"
            hint={data.rates.rates.map((r) => `${r.token} $${r.usd.toFixed(4)}`).join(" · ")}
          />
          <Row
            label="Gas / proofs"
            value={data.gasStation.enabled ? "sponsoring" : "local proofs"}
            hint="Undeployed settles with genesis server-append + local proof server — no EVM gas station."
          />
          <Row
            label="Paymaster"
            value="not used"
            hint="StreetRail settles experimental mUSDC on Midnight Undeployed; EVM paymasters are out of path."
          />
        </ul>
      )}
    </section>
  );
}
