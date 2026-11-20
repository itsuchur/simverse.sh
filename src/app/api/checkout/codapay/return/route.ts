import * as Sentry from "@sentry/nextjs";
import { z } from "zod";
import { reconcileCodapayPayment } from "~/server/orders/codapay";
import { paymentReturnTarget } from "~/server/urls";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const params = z
    .object({
      orderId: z.string().uuid(),
      txnId: z.string().regex(/^[1-9]\d*$/),
    })
    .safeParse(Object.fromEntries(searchParams));
  if (!params.success)
    return Response.json({ error: "invalid_payment" }, { status: 400 });
  try {
    const status = await reconcileCodapayPayment(
      params.data.txnId,
      params.data.orderId,
    );
    if (status === "pending")
      return Response.json({ error: "payment_pending" }, { status: 503 });
    return Response.redirect(paymentReturnTarget(status, searchParams), 303);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: "codapay", reason: "return_failed" },
    });
    return Response.json(
      { error: "payment_verification_unavailable" },
      { status: 503 },
    );
  }
}
