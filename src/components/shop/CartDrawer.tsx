import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, Minus, Plus, Trash2, ExternalLink, Loader2, Zap, History } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import { usePayToken } from "@/lib/pay-token";
import { useWallet } from "@/lib/wallet-context";
import { settleOnMidnight, settlementNote } from "@/lib/settle";
import { DEMO_SCALE } from "@/lib/agent-card";
import { TOKENS, formatAmount, toAtomic, convertFromFiat, type FxRates } from "@/lib/tokens";
import { useServerFn } from "@tanstack/react-start";
import { fetchFxRates } from "@/lib/fx.functions";
import { LiveTotalCalculator } from "@/components/fx/LiveTotalCalculator";
import { recordSettlement } from "@/lib/tx-log";

type PayState =
  | { phase: "idle" }
  | { phase: "paying" }
  | { phase: "paid"; url: string; amount: string }
  | { phase: "error"; message: string };

export function CartDrawer() {
  const [open, setOpen] = useState(false);
  const {
    items,
    isLoading,
    isSyncing,
    updateQuantity,
    removeItem,
    getCheckoutUrl,
    syncCart,
  } = useCartStore();
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalPrice = items.reduce(
    (s, i) => s + parseFloat(i.price.amount) * i.quantity,
    0,
  );

  const [payToken] = usePayToken();
  const tokenCfg = TOKENS[payToken];
  const { authenticated, login, wallets, available } = useWallet();
  const [fx, setFx] = useState<FxRates | null>(null);
  const getFx = useServerFn(fetchFxRates);
  const [payState, setPayState] = useState<PayState>({ phase: "idle" });

  const currencyCode = items[0]?.price.currencyCode ?? "GBP";
  const settleAtomic = toAtomic(
    convertFromFiat(totalPrice * DEMO_SCALE, currencyCode, payToken, fx),
    payToken,
  );

  useEffect(() => {
    if (open) syncCart();
  }, [open, syncCart]);

  useEffect(() => {
    let mounted = true;
    void getFx({ data: undefined }).then((rates) => {
      if (mounted) setFx(rates);
    });
    return () => {
      mounted = false;
    };
  }, [getFx]);

  const handleShopifyCheckout = () => {
    const url = getCheckoutUrl();
    if (url) {
      window.open(url, "_blank");
      setOpen(false);
    }
  };

  const handlePayMusdc = async () => {
    if (!authenticated) {
      await login();
      return;
    }
    const session = wallets[0] ?? { address: "mn_addr_undeployed1qqqqserverappend" };
    setPayState({ phase: "paying" });
    try {
      const res = await settleOnMidnight(
        session,
        payToken,
        "streetrail:treasury:v1",
        settleAtomic,
        "h2h-cart",
      );
      recordSettlement({
        hash: res.hash,
        mode: "H2H",
        label:
          items.length === 1 && items[0]
            ? `${items[0].product.node.title} ×${items[0].quantity}`
            : `Cart checkout · ${totalItems} item${totalItems === 1 ? "" : "s"}`,
        token: payToken,
        atomic: res.atomic,
        to: res.to,
        from: res.from,
      });
      setPayState({
        phase: "paid",
        url: res.explorer,
        amount: formatAmount(settleAtomic, payToken),
      });
    } catch (e) {
      setPayState({ phase: "error", message: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative h-9 w-9 border-border bg-surface text-foreground hover:bg-secondary"
        >
          <ShoppingCart className="h-4 w-4" />
          {totalItems > 0 && (
            <Badge className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full p-0 text-[10px] bg-primary text-primary-foreground">
              {totalItems}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="flex h-full w-full flex-col border-border bg-surface-2 text-foreground sm:max-w-md">
        <SheetHeader className="flex-shrink-0 space-y-1">
          <SheetTitle className="text-base font-semibold tracking-tight text-foreground">
            Your cart
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground">
            {totalItems === 0
              ? "Empty — add something from the shop"
              : `${totalItems} item${totalItems !== 1 ? "s" : ""} · settle in mUSDC on Midnight Undeployed`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col pt-4">
          {items.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <ShoppingCart className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Your cart is empty</p>
              </div>
            </div>
          ) : (
            <>
              <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                <div className="space-y-3">
                  {items.map((item) => {
                    const img = item.product.node.images?.edges?.[0]?.node;
                    return (
                      <div key={item.variantId} className="flex gap-3 rounded-lg p-1.5">
                        <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-md bg-secondary">
                          {img && (
                            <img
                              src={img.url}
                              alt={item.product.node.title}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="truncate text-sm font-medium text-foreground">
                            {item.product.node.title}
                          </h4>
                          <p className="text-[11px] text-muted-foreground">
                            {item.selectedOptions.map((o) => o.value).join(" · ")}
                          </p>
                          <p className="mt-0.5 text-xs font-semibold text-glow">
                            {item.price.currencyCode}{" "}
                            {parseFloat(item.price.amount).toFixed(2)}
                          </p>
                        </div>
                        <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => removeItem(item.variantId)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                          <div className="flex items-center gap-0.5">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 border-border bg-surface"
                              onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-5 text-center text-xs tabular-nums">
                              {item.quantity}
                            </span>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-7 w-7 border-border bg-surface"
                              onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex-shrink-0 space-y-2.5 border-t border-border pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">Total</span>
                  <span className="text-base font-bold tabular-nums text-glow">
                    {items[0]?.price.currencyCode || "£"} {totalPrice.toFixed(2)}
                  </span>
                </div>

                <LiveTotalCalculator
                  fiatAmount={totalPrice}
                  fiatCurrency={items[0]?.price.currencyCode ?? "GBP"}
                  scale={DEMO_SCALE}
                  note={settlementNote(payToken)}
                />

                {available && (
                  <Button
                    onClick={() => void handlePayMusdc()}
                    variant="outline"
                    className="h-9 w-full border-primary/50 bg-primary/10 text-xs font-semibold text-foreground hover:bg-primary/20"
                    disabled={items.length === 0 || payState.phase === "paying"}
                  >
                    {payState.phase === "paying" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <>
                        <Zap className="mr-1.5 h-3.5 w-3.5" />
                        {authenticated
                          ? `Pay ${tokenCfg.symbol} on Midnight`
                          : "Connect Lace to pay"}
                      </>
                    )}
                  </Button>
                )}

                {payState.phase === "paid" && (
                  <a
                    href={payState.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-foreground underline decoration-glow/60 underline-offset-2"
                  >
                    Settled {payState.amount} — view on indexer
                  </a>
                )}

                {payState.phase === "error" && (
                  <p className="rounded-md border border-destructive/40 bg-destructive/10 px-2.5 py-1.5 text-[11px] text-foreground">
                    {payState.message}
                  </p>
                )}

                <Link
                  to="/judge"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-glow underline decoration-glow/40 underline-offset-2 transition hover:text-primary"
                >
                  <History className="h-3 w-3" />
                  Recent settlements
                </Link>

                {payState.phase === "idle" && (
                  <p className="text-[10px] leading-snug text-muted-foreground">
                    {settlementNote(payToken)} Demo scale ×{DEMO_SCALE}.
                    {fx?.stale ? " FX fallback active." : fx ? ` FX: ${fx.source}.` : ""}
                  </p>
                )}

                <Button
                  onClick={handleShopifyCheckout}
                  variant="secondary"
                  className="h-8 w-full text-[11px] font-medium text-muted-foreground"
                  disabled={items.length === 0 || isLoading || isSyncing}
                >
                  {isLoading || isSyncing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <ExternalLink className="mr-1.5 h-3 w-3" />
                      Optional: Shopify checkout
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
