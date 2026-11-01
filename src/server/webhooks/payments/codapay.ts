import "server-only";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { withWebhookLogging } from "~/lib/webhook-logger";
import { verifyCodapayChecksum } from "~/server/payments/codapay";
import { reconcileCodapayPayment } from "~/server/orders/codapay";

const schema = z.object({
  TxnId: z.string().regex(/^[1-9]\d*$/),
  OrderId: z.string().uuid(),
  ResultCode: z.string().regex(/^\d+$/),
  Checksum: z.string(),
});

const handle = withWebhookLogging(
  "codapay",
  async (_request, payload, _raw, persist) => {
    const parsed = schema.safeParse(payload);
    if (!parsed.success) return new Response("ResultCode=1", { status: 400 });
    if (!verifyCodapayChecksum(parsed.data))
      return new Response("ResultCode=1", { status: 401 });
    const unavailable = await persist();
    if (unavailable) return unavailable;
    try {
      await reconcileCodapayPayment(parsed.data.TxnId, parsed.data.OrderId);
      return new Response("ResultCode=0", {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: "codapay", reason: "webhook_failed" },
      });
      return new Response("ResultCode=1", { status: 503 });
    }
  },
);

export async function handleCodapayWebhook(request: Request) {
  const query = new URL(request.url).searchParams;
  for (const key of query.keys()) {
    if (query.getAll(key).length !== 1)
      return new Response("ResultCode=1", { status: 400 });
  }
  // Reuse the authenticated audit logger, including query fields such as USDPrice.
  return handle(
    new Request(request.url.split("?")[0]!, {
      method: "POST",
      headers: new Headers([
        ...request.headers,
        ["content-type", "application/json"],
      ]),
      body: JSON.stringify(Object.fromEntries(query)),
    }),
  );
}
