import { rejects } from "node:assert/strict";
import { afterAll, afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { OrdersController, type Order } from "@paypal/paypal-server-sdk";
import { createPaypalInvoice, paypalAmountToMinor } from "./paypal";
import {
  applyVerifiedPaypalOrder,
  reconcilePaypalOrder,
} from "~/server/orders/paypal";
import { fakeDb } from "~/test/fake-db";
import {
  resetTestState,
  stubEsimAccess,
  esimOrderCallCount,
} from "~/test/mocks";
import { GET } from "~/app/api/checkout/paypal/return/route";

const getOrder = spyOn(OrdersController.prototype, "getOrder");
const capture = spyOn(OrdersController.prototype, "captureOrder");
const create = spyOn(OrdersController.prototype, "createOrder");
afterAll(() => {
  getOrder.mockRestore();
  capture.mockRestore();
  create.mockRestore();
});
beforeEach(() => {
  resetTestState();
  getOrder.mockReset();
  capture.mockReset();
  create.mockReset();
});
afterEach(() => {
  getOrder.mockReset();
  capture.mockReset();
  create.mockReset();
});

function seed() {
  fakeDb.seedUser({ id: "user-1", telegramId: "42" });
  return fakeDb.seedOrder({
    paymentProvider: "paypal",
    paymentInvoiceId: "PAYPAL123",
    priceAmount: 1099n,
    currency: "USD",
  });
}
function payment(
  orderUuid: string,
  status = "COMPLETED",
  value = "10.99",
  currencyCode = "USD",
) {
  return {
    id: "PAYPAL123",
    status,
    purchaseUnits: [
      {
        customId: orderUuid,
        amount: { currencyCode, value },
        payments: {
          captures:
            status === "COMPLETED"
              ? [
                  {
                    id: "CAPTURE123",
                    status: "COMPLETED",
                    amount: { currencyCode, value },
                  },
                ]
              : [],
        },
      },
    ],
  };
}
function response(result: unknown) {
  return { result: result as Order, statusCode: 200, headers: {} } as Awaited<
    ReturnType<OrdersController["getOrder"]>
  >;
}

test("PayPal amounts use exact minor units", () => {
  expect(paypalAmountToMinor("10.99")).toBe(1099n);
  expect(paypalAmountToMinor("0.1")).toBe(10n);
  for (const value of ["-1", "1e2", "1.001", "NaN", "1,00", ""])
    expect(() => paypalAmountToMinor(value)).toThrow();
});

test("creation sends the stored USD amount, merchant UUID and idempotency key", async () => {
  create.mockResolvedValue(
    response({
      id: "PAYPAL123",
      links: [
        {
          rel: "payer-action",
          href: "https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL123",
        },
      ],
    }),
  );
  const invoice = await createPaypalInvoice({
    amount: 1099n,
    orderId: "merchant-order",
  });
  expect(invoice.uuid).toBe("PAYPAL123");
  const args = create.mock.calls[0]![0];
  expect(args.paypalRequestId).toBe("merchant-order");
  expect(args.body.purchaseUnits[0]?.amount).toEqual({
    currencyCode: "USD",
    value: "10.99",
  });
  expect(args.body.purchaseUnits[0]?.customId).toBe("merchant-order");
  expect(
    args.body.paymentSource?.paypal?.experienceContext?.cancelUrl,
  ).toContain("/checkout/paypal/return?status=fail");
});

test("approval captures once with a stable idempotency key and duplicate completion fulfills once", async () => {
  const order = seed();
  stubEsimAccess({ orderNo: "EA-PAYPAL", profiles: [] });
  getOrder.mockResolvedValueOnce(
    response(payment(order.orderUuid, "APPROVED")),
  );
  capture.mockResolvedValueOnce(response(payment(order.orderUuid)));
  expect(await reconcilePaypalOrder("PAYPAL123")).toBe(true);
  expect(capture.mock.calls[0]![0].paypalRequestId).toBe("capture-PAYPAL123");
  expect(order.paymentChargeId).toBe("CAPTURE123");
  getOrder.mockResolvedValueOnce(response(payment(order.orderUuid)));
  expect(await reconcilePaypalOrder("PAYPAL123")).toBe(true);
  expect(capture).toHaveBeenCalledTimes(1);
  expect(esimOrderCallCount()).toBe(1);
});

test("lost capture response is recovered through the merchant API", async () => {
  const order = seed();
  stubEsimAccess({ orderNo: "EA-PAYPAL", profiles: [] });
  getOrder
    .mockResolvedValueOnce(response(payment(order.orderUuid, "APPROVED")))
    .mockResolvedValueOnce(response(payment(order.orderUuid)));
  capture.mockRejectedValueOnce(new Error("timeout"));
  expect(await reconcilePaypalOrder("PAYPAL123")).toBe(true);
  expect(order.paymentStatus).toBe("paid");
});

test("unapproved orders never capture or fulfill", async () => {
  const order = seed();
  getOrder.mockResolvedValueOnce(response(payment(order.orderUuid, "CREATED")));
  expect(await reconcilePaypalOrder("PAYPAL123")).toBe(false);
  expect(capture).not.toHaveBeenCalled();
  expect(order.paymentStatus).toBe("pending");
});

test("approval amount mismatch and foreign invoice are rejected before capture", async () => {
  const order = seed();
  getOrder.mockResolvedValueOnce(
    response(payment(order.orderUuid, "APPROVED", "1.00")),
  );
  await rejects(reconcilePaypalOrder("PAYPAL123"), /amount mismatch/);
  order.paymentInvoiceId = "OTHER";
  getOrder.mockResolvedValueOnce(
    response(payment(order.orderUuid, "APPROVED")),
  );
  await rejects(reconcilePaypalOrder("PAYPAL123"), /invoice mismatch/);
  expect(capture).not.toHaveBeenCalled();
  expect(order.paymentStatus).toBe("pending");
});

for (const [value, currency] of [
  ["1.00", "USD"],
  ["10.99", "EUR"],
]) {
  test(`captured ${value} ${currency} mismatch enters manual review without provisioning`, async () => {
    const order = seed();
    await applyVerifiedPaypalOrder(
      payment(order.orderUuid, "COMPLETED", value, currency),
    );
    expect(order.status).toBe("refund_required");
    expect(order.paymentChargeId).toBe("CAPTURE123");
    expect(esimOrderCallCount()).toBe(0);
  });
}

test("merchant custom ID recovers a lost creation response", async () => {
  const order = seed();
  order.paymentInvoiceId = null;
  stubEsimAccess({ orderNo: "EA-PAYPAL", profiles: [] });
  await applyVerifiedPaypalOrder(payment(order.orderUuid));
  expect(String(order.paymentInvoiceId)).toBe("PAYPAL123");
  expect(order.paymentStatus).toBe("paid");
});

test("cancel return does not capture or mark an order paid", async () => {
  const order = seed();
  const result = await GET(
    new Request(
      "http://localhost/api/checkout/paypal/return?status=fail&token=PAYPAL123",
    ),
  );
  expect(result.status).toBe(303);
  expect(result.headers.get("location")).toContain("failed_payment");
  expect(order.paymentStatus).toBe("pending");
  expect(getOrder).not.toHaveBeenCalled();
});
