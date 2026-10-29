import "server-only";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { withWebhookLogging } from "~/lib/webhook-logger";
import { verifyPaypalWebhook } from "~/server/payments/paypal";
import { reconcilePaypalOrder } from "~/server/orders/paypal";

const eventSchema = z.object({
  id: z.string().min(1),
  event_type: z.string(),
  resource: z.object({
    id: z.string().min(1),
    supplementary_data: z
      .object({ related_ids: z.object({ order_id: z.string().min(1) }) })
      .optional(),
  }),
});

export const handlePaypalWebhook = withWebhookLogging(
  "paypal",
  async (request, payload, _raw, persist) => {
    const parsed = eventSchema.safeParse(payload);
    if (!parsed.success)
      return Response.json({ error: "invalid_event" }, { status: 400 });
    try {
      if (!(await verifyPaypalWebhook(request.headers, payload)))
        return Response.json({ error: "Unauthorized" }, { status: 401 });
      const unavailable = await persist();
      if (unavailable) return unavailable;
      const event = parsed.data;
      if (event.event_type === "CHECKOUT.ORDER.APPROVED") {
        await reconcilePaypalOrder(event.resource.id);
      } else if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
        const id = event.resource.supplementary_data?.related_ids.order_id;
        if (!id)
          return Response.json({ error: "missing_order_id" }, { status: 400 });
        await reconcilePaypalOrder(id);
      }
      return Response.json({ message: "Webhook received" });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { component: "paypal", reason: "webhook_failed" },
      });
      return Response.json(
        { error: "verification_unavailable" },
        { status: 503 },
      );
    }
  },
);
