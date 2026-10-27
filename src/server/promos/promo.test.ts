import { beforeEach, expect, mock, test } from "bun:test";

import { fulfillTrybitPayment } from "~/server/orders/fulfill";
import { failPendingInvoice } from "~/server/orders/draft";
import { fakeDb } from "~/test/fake-db";
import { getCartSnapshot, resetTestState, stubEsimAccess } from "~/test/mocks";

import { placeCheckoutOrder, PromoError, quotePromo } from "./promo";

const rateLimitModule = await import("~/server/http/rate-limit");
const limitRequest = mock(
  async (_userId: string, _scope: string): Promise<Response | null> => null,
);
const limitPromo = mock(
  async (_userId: string): Promise<Response | null> => null,
);
void mock.module("~/server/http/rate-limit", () => ({
  ...rateLimitModule,
  limitMiniappRequest: limitRequest,
  limitPromoAttempt: limitPromo,
}));
void mock.module("~/server/better-auth", () => ({
  getAuth: () => ({
    api: {
      getSession: async () => ({ user: { id: "user-1", telegramId: "42" } }),
    },
  }),
}));
void mock.module("~/server/sales", () => ({ isSalesActive: async () => true }));

const { POST: previewPromo } = await import("~/app/api/checkout/promo/route");

const revision = "6f1b5c3a-1d2e-4f5a-8b7c-9d0e1f2a3b4c";

function draft(
  overrides: {
    paymentProvider?: string;
    userId?: string;
    priceAmount?: bigint;
  } = {},
) {
  return {
    userId: overrides.userId ?? "user-1",
    resellerPlanId: "PKG-1",
    packageName: "Test 1GB 7Days",
    countryCode: "US",
    dataAmountMb: 1024,
    validityDays: 7,
    priceAmount: overrides.priceAmount ?? 10_000n,
    currency: "USD",
    costAmount: 500n,
    costCurrency: "USD",
    paymentProvider: overrides.paymentProvider ?? "trybit",
    cartRevision: revision,
  };
}

async function seedPromo(input?: {
  maxPerUser?: number | null;
  maxRedemptions?: number | null;
  code?: string;
}) {
  return fakeDb.promoCode.create({
    data: {
      code: input?.code ?? "WELCOME10",
      discountPercent: 10,
      maxPerUser: input?.maxPerUser === undefined ? 1 : input.maxPerUser,
      maxRedemptions: input?.maxRedemptions ?? null,
      startsAt: new Date(Date.now() - 60_000),
      endsAt: null,
      note: null,
      revokedAt: null,
      revokedById: null,
      revokeReason: null,
      createdById: null,
    },
  });
}

beforeEach(() => {
  resetTestState();
  limitRequest.mockReset();
  limitRequest.mockResolvedValue(null);
  limitPromo.mockReset();
  limitPromo.mockResolvedValue(null);
  fakeDb.seedUser({ id: "user-1", telegramId: "42" });
});

test("preview returns discounted prices and does not reserve the code", async () => {
  await seedPromo();
  getCartSnapshot.mockResolvedValue({
    revision,
    plan: { price: 100, price_rub: 1000 } as never,
  });
  const response = await previewPromo(
    new Request("http://localhost/api/checkout/promo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cartRevision: revision, promoCode: "welcome10" }),
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    discountPercent: 10,
    priceRub: 900,
    priceUsd: 90,
  });
  expect(await fakeDb.promoRedemption.findMany()).toHaveLength(0);
});

test("preview stops before the promo lookup once the user is over the attempt limit", async () => {
  getCartSnapshot.mockResolvedValue({
    revision,
    plan: { price: 100, price_rub: 1000 } as never,
  });
  limitPromo.mockResolvedValue(
    Response.json(
      { error: "rate_limited" },
      { status: 429, headers: { "Retry-After": "600" } },
    ),
  );
  const response = await previewPromo(
    new Request("http://localhost/api/checkout/promo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cartRevision: revision, promoCode: "WELCOME10" }),
    }),
  );
  expect(response.status).toBe(429);
  expect(await response.json()).toEqual({ error: "rate_limited" });
  expect(limitPromo).toHaveBeenCalledWith("user-1");
  expect(await fakeDb.promoCode.findMany()).toHaveLength(0);
});

test("preview rejects a code with special characters before reading a price", async () => {
  await seedPromo();
  const response = await previewPromo(
    new Request("http://localhost/api/checkout/promo", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        cartRevision: revision,
        promoCode: "WELCOME10'; DROP TABLE promo_codes;--",
      }),
    }),
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: "invalid_code" });
  expect(getCartSnapshot).not.toHaveBeenCalled();
  expect(limitPromo).not.toHaveBeenCalled();
  expect(await fakeDb.promoRedemption.findMany()).toHaveLength(0);
});

test("quote does not write a redemption", async () => {
  await seedPromo();
  const quote = await quotePromo({
    code: "WELCOME10",
    userId: "user-1",
    priceRub: 1000,
    priceUsd: 100,
  });
  expect(quote.priceUsd).toBe(90);
  expect(await fakeDb.promoRedemption.findMany()).toHaveLength(0);
});

test("checkout reserves a discounted order", async () => {
  await seedPromo();
  const order = await placeCheckoutOrder(draft(), "WELCOME10");
  expect(order.priceAmount).toBe(9_000n);
  expect(order.promoCodeId).not.toBeNull();
  const redemptions = await fakeDb.promoRedemption.findMany();
  expect(redemptions).toHaveLength(1);
  expect(redemptions[0]?.listPriceAmount).toBe(10_000n);
  expect(redemptions[0]?.chargedAmount).toBe(9_000n);
  expect(redemptions[0]?.consumedAt).toBeNull();
});

test("a second payment method is rejected while a once-per-user invoice is open", async () => {
  await seedPromo();
  const order = await placeCheckoutOrder(draft(), "WELCOME10");
  await fakeDb.order.update({
    where: { id: order.id },
    data: { paymentInvoiceUrl: "https://pay.example/invoice" },
  });
  let caught: unknown;
  try {
    await placeCheckoutOrder(draft({ paymentProvider: "xhub" }), "WELCOME10");
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(PromoError);
  expect((caught as PromoError).code).toBe("promo_held");
  expect(await fakeDb.promoRedemption.findMany()).toHaveLength(1);
});

test("an unlimited code can be reserved on two checkouts", async () => {
  await seedPromo({ maxPerUser: null });
  await placeCheckoutOrder(draft(), "WELCOME10");
  await placeCheckoutOrder(draft({ paymentProvider: "xhub" }), "WELCOME10");
  expect(await fakeDb.promoRedemption.findMany()).toHaveLength(2);
});

test("a paid order consumes the reservation", async () => {
  await seedPromo();
  stubEsimAccess();
  const order = await placeCheckoutOrder(draft(), "WELCOME10");
  await fulfillTrybitPayment({
    orderUuid: order.orderUuid,
    invoiceUuid: "INV-PROMO",
    amountUsd: 90,
  });
  const [redemption] = await fakeDb.promoRedemption.findMany();
  expect(redemption?.consumedAt).toBeInstanceOf(Date);
});

test("a draft that never reached a provider releases the reservation", async () => {
  await seedPromo();
  const order = await placeCheckoutOrder(draft(), "WELCOME10");
  await failPendingInvoice(order.id, "expired");
  const [redemption] = await fakeDb.promoRedemption.findMany();
  expect(redemption?.releasedAt).toBeInstanceOf(Date);
  const again = await placeCheckoutOrder(draft(), "WELCOME10");
  expect(again.id).not.toBe(order.id);
  const live = (await fakeDb.promoRedemption.findMany()).filter(
    (item) => item.releasedAt == null,
  );
  expect(live).toHaveLength(1);
});
