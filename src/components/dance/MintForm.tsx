import { useEffect, useState } from "react";
import { useWallet } from "@/lib/wallet-context";
import { useServerFn } from "@tanstack/react-start";
import { INDEXER_URL, TOKENS, type TokenKey, convertFromUsd, type FxRates, txExplorerUrl } from "@/lib/tokens";
import midnightContract from "@/data/midnight-contract.json";
import { TokenSwitcher } from "./TokenSwitcher";
import { fetchFxRates } from "@/lib/fx.functions";
import { MetadataPreview } from "./MetadataPreview";

export function MintForm() {
  const { authenticated, login } = useWallet();
  const [token, setToken] = useState<TokenKey>("USDC");
  const [cid, setCid] = useState("");
  const [amount, setAmount] = useState("1");
  const [usdAmount, setUsdAmount] = useState("1");
  const [mode, setMode] = useState<"token" | "usd">("token");
  const [fx, setFx] = useState<FxRates | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const getFx = useServerFn(fetchFxRates);

  useEffect(() => {
    let mounted = true;
    void getFx({ data: undefined }).then((rates) => {
      if (mounted) setFx(rates);
    });
    return () => {
      mounted = false;
    };
  }, [getFx]);

  const contractAddress =
    (import.meta.env.VITE_DEFAULT_CONTRACT as string) ||
    (midnightContract as { address?: string }).address ||
    "";
  const contractDeployed =
    !!contractAddress && !/^0+$/.test(contractAddress.replace(/^0x/, ""));

  const tokenPerUsd = convertFromUsd(1, token, fx) || 1;
  const tokenAmount =
    mode === "usd"
      ? convertFromUsd(parseFloat(usdAmount || "0"), token, fx).toFixed(6)
      : amount;
  const usdEquivalent =
    mode === "usd" ? parseFloat(usdAmount || "0") : parseFloat(amount || "0") / tokenPerUsd;

  async function onSubmit() {
    setError(null);
    setTxHash(null);
    setBusy(true);
    setStatus(null);
    try {
      if (!authenticated) {
        await login();
        return;
      }
      if (!contractDeployed) {
        throw new Error("MoveRegistry not deployed. Run: bun run compile");
      }
      if (!cid.trim()) throw new Error("Enter a move CID or message to anchor.");

      setStatus("Proving… first mint can take up to ~4 min on a cold proof server.");
      const message = JSON.stringify({
        kind: "move-log",
        cid: cid.trim(),
        token,
        amount: tokenAmount,
        usd: usdEquivalent,
        at: new Date().toISOString(),
      });
      const res = await fetch("/api/public/append-entry", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contractAddress,
          appTag: "streetrail_move_registry",
          message,
        }),
      });
      const body = (await res.json()) as { txId?: string; error?: string };
      if (!res.ok) throw new Error(body.error || `append-entry failed (${res.status})`);
      setTxHash(body.txId || null);
      setStatus("Anchored on Midnight Undeployed MoveRegistry.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-3xl border border-border bg-card/60 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Move registry</p>
          <h3 className="display text-xl text-foreground">Log a move on Midnight</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Server-append via genesis wallet · indexer {INDEXER_URL}
          </p>
        </div>
        <TokenSwitcher value={token} onChange={setToken} />
      </div>

      <label className="block text-xs text-muted-foreground">
        Amount ({TOKENS[token].symbol})
        <input
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={mode === "usd" ? undefined : amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setMode("token");
          }}
          placeholder="1.0"
        />
      </label>
      <label className="block text-xs text-muted-foreground">
        USD equivalent
        <input
          className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={mode === "token" ? usdEquivalent.toFixed(2) : usdAmount}
          onChange={(e) => {
            setUsdAmount(e.target.value);
            setMode("usd");
          }}
        />
      </label>

      <MetadataPreview
        token={token === "cirBTC" ? "cirBTC" : token === "EURC" ? "EURC" : "USDC"}
        amount={tokenAmount}
        cid={cid || null}
        pinningEnabled={false}
        maxUploadBytes={0}
        onConfirm={(next) => setCid(next)}
        onReset={() => setCid("")}
      />

      <button
        type="button"
        disabled={busy || !cid.trim()}
        onClick={() => void onSubmit()}
        className="inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Proving…" : authenticated ? "Prove & append move" : "Connect & append"}
      </button>

      {!contractDeployed && (
        <p className="text-xs text-amber-400">
          Contract address missing — run <code>bun run compile</code> after Docker is up.
        </p>
      )}
      {status && <p className="text-xs text-muted-foreground">{status}</p>}
      {error && <p className="text-xs text-red-400">{error}</p>}
      {txHash && (
        <a
          className="block text-xs text-glow underline"
          href={txExplorerUrl(txHash)}
          target="_blank"
          rel="noreferrer"
        >
          View tx in indexer · {txHash.slice(0, 18)}…
        </a>
      )}
    </div>
  );
}
