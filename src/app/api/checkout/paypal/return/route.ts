import * as Sentry from "@sentry/nextjs";
import { reconcilePaypalOrder } from "~/server/orders/paypal";
import { paymentReturnTarget } from "~/server/urls";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.get("status") === "fail")
    return Response.redirect(paymentReturnTarget("fail", params), 303);
  const token = params.get("token");
  if (!token || !/^[A-Z0-9]{1,64}$/.test(token))
    return Response.json({ error: "invalid_token" }, { status: 400 });
  try {
    const complete = await reconcilePaypalOrder(token);
    if (!complete)
      return Response.json({ error: "payment_pending" }, { status: 503 });
    return Response.redirect(paymentReturnTarget("success", params), 303);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: "paypal", reason: "capture_failed" },
    });
    return Response.json(
      { error: "payment_verification_unavailable" },
      { status: 503 },
    );
  }
}
