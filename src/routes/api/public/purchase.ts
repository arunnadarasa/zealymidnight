import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { DEMO_SCALE, MIDNIGHT_NETWORK } from "@/lib/agent-card";
import {
  TOKENS,
  TOKEN_KEYS,
  caip19,
  formatAmount,
  toAtomic,
  convertFromFiat,
  FALLBACK_RATES,
  INDEXER_URL,
  txExplorerUrl,
  type TokenKey,
  type FxRates,
} from "@/lib/tokens";
import { getFxRates } from "@/lib/fx.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-PAYMENT, PAYMENT-SIGNATURE",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE, PAYMENT-RESPONSE",
};

const OrderSchema = z.object({
  sku: z.string().min(1).max(200),
  variantId: z.string().min(1).max(300).optional(),
  quantity: z.number().int().min(1).max(20).default(1),
  listedAmount: z.number().min(0).max(100000),
  currency: z.string().min(2).max(8).default("GBP"),
  token: z.enum(TOKEN_KEYS as [TokenKey, ...TokenKey[]]).default("USDC"),
  agentId: z.string().min(1).max(100).optional(),
  rightsCid: z.string().max(200).optional(),
  /** When true, server settles via genesis mUSDC transfer (Undeployed). */
  serverSettle: z.boolean().optional(),
});

const PaymentSchema = z.object({
  txHash: z.string().min(8),
  from: z.string().min(1).optional(),
  nonce: z.string().max(100).optional(),
  scheme: z.string().optional(),
});

function requiredAtomic(
  listedAmount: number,
  quantity: number,
  currency: string,
  token: TokenKey,
  fx: FxRates,
) {
  const tokenAmount = convertFromFiat(
    listedAmount * quantity * DEMO_SCALE,
    currency,
    token,
    fx,
  );
  return toAtomic(tokenAmount, token);
}

export const Route = createFileRoute("/api/public/purchase")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const payTo = process.env["VITE_TREASURY_LABEL"] ?? "streetrail:treasury:v1";

        let raw: unknown;
        try {
          raw = await request.json();
        } catch {
          return Response.json({ error: "invalid_json" }, { status: 400, headers: CORS });
        }

        const parsed = OrderSchema.safeParse(raw);
        if (!parsed.success) {
          return Response.json(
            { error: "invalid_request", issues: parsed.error.issues.slice(0, 5) },
            { status: 400, headers: CORS },
          );
        }
        const order = parsed.data;
        const token = order.token;
        const cfg = TOKENS[token];

        let fx: FxRates;
        try {
          fx = await getFxRates();
        } catch {
          fx = FALLBACK_RATES;
        }

        const atomic = requiredAtomic(
          order.listedAmount,
          order.quantity,
          order.currency,
          token,
          fx,
        );
        const resource = new URL(request.url).toString();
        const paymentHeader =
          request.headers.get("X-PAYMENT") || request.headers.get("PAYMENT-SIGNATURE");

        // ---- No payment: 402 challenge (midnight-mUSDC) --------------------
        if (!paymentHeader && !order.serverSettle) {
          return Response.json(
            {
              x402Version: 2,
              error: "payment_required",
              accepts: [
                {
                  scheme: "midnight-mUSDC",
                  network: MIDNIGHT_NETWORK,
                  asset: caip19(token),
                  amount: atomic.toString(),
                  amountFormatted: formatAmount(atomic, token),
                  decimals: 6,
                  symbol: "mUSDC",
                  payTo,
                  resource,
                  description: `${order.quantity} × ${order.sku}`,
                  maxTimeoutSeconds: 300,
                  nonce: crypto.randomUUID(),
                  preferred: true,
                  extra: {
                    settlement:
                      "Undeployed server-append via /api/public/musdc-transfer (genesis wallet)",
                    indexer: INDEXER_URL,
                    demoScale: DEMO_SCALE,
                    fx: {
                      source: fx.source,
                      usdPerGbp: fx.usdPerGbp,
                      usdPerEur: fx.usdPerEur,
                      usdPerBtc: fx.usdPerBtc,
                    },
                    listed: `${order.listedAmount.toFixed(2)} ${order.currency} × ${order.quantity}`,
                  },
                },
              ],
            },
            { status: 402, headers: CORS },
          );
        }

        // ---- Server-settle path (H2A/A2A Undeployed) ----------------------
        try {
          let txHash = "";
          let from = "genesis";

          if (order.serverSettle || !paymentHeader) {
            const { musdcFaucet, musdcTransfer } = await import("@/lib/musdc.server");
            await musdcFaucet().catch(() => {});
            const settled = await musdcTransfer({ amountAtomic: atomic.toString() });
            txHash = settled.midnightTxHash;
            from = settled.fromPk;
          } else {
            let payment: z.infer<typeof PaymentSchema>;
            try {
              const decoded = JSON.parse(atob(paymentHeader));
              const p = PaymentSchema.safeParse(decoded);
              if (!p.success) {
                return Response.json(
                  { error: "invalid_payment_payload", issues: p.error.issues.slice(0, 5) },
                  { status: 400, headers: CORS },
                );
              }
              payment = p.data;
            } catch {
              return Response.json(
                { error: "invalid_payment_payload", detail: "X-PAYMENT must be base64 JSON." },
                { status: 400, headers: CORS },
              );
            }
            txHash = payment.txHash;
            from = payment.from || "lace";
          }

          const settled = {
            success: true,
            transaction: txHash,
            network: MIDNIGHT_NETWORK,
            asset: caip19(token),
            payer: from,
            amount: atomic.toString(),
            simulated: false,
          };

          return Response.json(
            {
              type: "order",
              status: "fulfilment_pending",
              order_id: `SK-${String(txHash).replace(/^0x/, "").slice(0, 8).toUpperCase()}`,
              sku: order.sku,
              variant_id: order.variantId ?? null,
              quantity: order.quantity,
              settled: {
                ...settled,
                token: cfg.symbol,
                amountFormatted: formatAmount(atomic, token),
                explorer: txExplorerUrl(txHash),
              },
              listed_total: `${(order.listedAmount * order.quantity).toFixed(2)} ${order.currency}`,
              rights_cid: order.rightsCid ?? null,
              fulfilment: {
                method: "ship_physical",
                next: "Merchant agent requests a shipping address over A2A input-required.",
              },
              issued_at: new Date().toISOString(),
            },
            {
              status: 200,
              headers: {
                ...CORS,
                "X-PAYMENT-RESPONSE": btoa(JSON.stringify(settled)),
                "PAYMENT-RESPONSE": btoa(JSON.stringify(settled)),
              },
            },
          );
        } catch (err) {
          const detail = err instanceof Error ? err.message : String(err);
          console.error("x402 midnight settle failed:", detail);
          return Response.json(
            { error: "verification_failed", detail },
            { status: 502, headers: CORS },
          );
        }
      },
    },
  },
});
