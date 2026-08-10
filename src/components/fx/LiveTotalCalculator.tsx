import { useEffect, useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { usePayToken } from "@/lib/pay-token";
import { fetchFxRates } from "@/lib/fx.functions";
import { TOKENS, convertFromFiat, getTokenUsdRate, formatAmount, toAtomic, type FxRates } from "@/lib/tokens";
import { Loader2 } from "lucide-react";

interface LiveTotalCalculatorProps {
  /** Listed fiat amount (before any demo scaling). */
  fiatAmount: number;
  /** ISO currency code of the listed price, e.g. GBP, USD, EUR. */
  fiatCurrency: string;
  /** Optional scaling factor (e.g. DEMO_SCALE) applied to the fiat amount before conversion. */
  scale?: number;
  /** Additional context line shown under the total. */
  note?: string;
  /** Smaller type for drawers / tight panels. */
  compact?: boolean;
  className?: string;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  USD: "$",
  EUR: "€",
  USDC: "$",
  EURC: "€",
};

function currencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code.toUpperCase()] || code.toUpperCase();
}

export function LiveTotalCalculator({
  fiatAmount,
  fiatCurrency,
  scale = 1,
  note,
  compact = false,
  className = "",
}: LiveTotalCalculatorProps) {
  const [payToken] = usePayToken();
  const [fx, setFx] = useState<FxRates | null>(null);
  const [loading, setLoading] = useState(false);
  const getFx = useServerFn(fetchFxRates);

  const tokenCfg = TOKENS[payToken];

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    void getFx({ data: undefined })
      .then((rates) => {
        if (mounted) setFx(rates);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [getFx]);

  const { scaledFiat, usdEquivalent, tokenAmount, atomic, rate } = useMemo(() => {
    const scaled = fiatAmount * scale;
    const usd = convertFromFiat(scaled, fiatCurrency, "USDC", fx);
    const tokenAmt = convertFromFiat(scaled, fiatCurrency, payToken, fx);
    const atomicValue = toAtomic(tokenAmt, payToken);
    const tokenUsdRate = getTokenUsdRate(payToken, fx);
    return {
      scaledFiat: scaled,
      usdEquivalent: usd,
      tokenAmount: tokenAmt,
      atomic: atomicValue,
      rate: tokenUsdRate,
    };
  }, [fiatAmount, fiatCurrency, scale, payToken, fx]);

  const symbol = currencySymbol(fiatCurrency);
  const tokenPlaces = tokenCfg.decimals === 8 ? 8 : 6;

  return (
    <div
      className={`rounded-xl border border-border bg-surface/60 backdrop-blur-sm ${compact ? "p-2.5" : "rounded-2xl p-4"} ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className={`font-semibold uppercase tracking-widest text-muted-foreground ${compact ? "text-[10px]" : "text-xs font-bold"}`}>
          Live mUSDC total
        </span>
        {loading && !fx ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : fx?.stale ? (
          <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-400">
            Fallback rate
          </span>
        ) : fx ? (
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
            Live FX
          </span>
        ) : null}
      </div>

      <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-1 ${compact ? "mt-1.5" : "mt-3 gap-x-3"}`}>
        <span className={`font-bold text-foreground ${compact ? "text-lg tabular-nums" : "display text-3xl font-black sm:text-4xl"}`}>
          {tokenAmount.toFixed(tokenPlaces)} {tokenCfg.symbol}
        </span>
        <span className={`text-muted-foreground ${compact ? "text-[11px]" : "text-sm"}`}>
          ≈ {symbol}
          {scaledFiat.toFixed(2)} listed
          {scale !== 1 && (
            <span className="ml-1 text-[10px] opacity-70">(×{scale})</span>
          )}
        </span>
      </div>

      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground ${compact ? "mt-1 text-[10px]" : "mt-2 gap-x-4 text-xs"}`}>
        <span>
          1 USD ≈{" "}
          <span className="font-mono font-semibold text-foreground">
            {rate.toPrecision(tokenCfg.decimals === 8 ? 6 : 4)}
          </span>{" "}
          {tokenCfg.symbol}
        </span>
        <span>
          Listed USD:{" "}
          <span className="font-mono font-semibold text-foreground">
            ${usdEquivalent.toFixed(2)}
          </span>
        </span>
      </div>

      <div className={`rounded-md border border-border/60 bg-background/40 font-mono text-glow ${compact ? "mt-1.5 px-2 py-1 text-[10px]" : "mt-3 px-3 py-2 text-[11px]"}`}>
        {formatAmount(atomic, payToken)}
      </div>

      {note && <p className={`leading-snug text-muted-foreground ${compact ? "mt-1.5 text-[10px]" : "mt-3 text-[11px]"}`}>{note}</p>}

      {fx?.stale && (
        <p className={`leading-snug text-amber-400/90 ${compact ? "mt-1 text-[10px]" : "mt-2 text-[11px]"}`}>
          FX feed is offline; using cached/fallback rates. Totals may differ from market prices.
        </p>
      )}
    </div>
  );
}
