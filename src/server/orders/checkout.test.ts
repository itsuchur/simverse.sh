import { beforeEach, describe, expect, mock, test } from "bun:test";
import { fakeDb } from "~/test/fake-db";
import { esimAccessPost, getCartSnapshot, resetTestState } from "~/test/mocks";
import { invoiceResponse } from "./checkout";

const rateLimitModule = await import("~/server/http/rate-limit");
const limitRequest = mock(
  async (_userId: string, _scope: string): Promise<Response | null> => null,
);
void mock.module("~/server/http/rate-limit", () => ({
  ...rateLimitModule,
  limitMiniappRequest: limitRequest,
}));

void mock.module("~/server/better-auth", () => ({
  getAuth: () => ({
    api: {
      getSession: async () => ({ user: { id: "user-1", telegramId: "42" } }),
    },
  }),
}));
void mock.module("~/server/sales", () => ({ isSalesActive: async () => true }));

const { POST: stars } = await import("~/app/api/checkout/stars/route");
const { POST: trybit } = await import("~/app/api/checkout/trybit/route");
const { POST: cardlink } = await import("~/app/api/checkout/cardlink/route");
const { POST: cent } = await import("~/app/api/checkout/cent/route");
const { POST: platega } = await import("~/app/api/checkout/platega/route");
const { POST: xhub } = await import("~/app/api/checkout/xhub/route");
const { POST: topup } = await import("~/app/api/checkout/topup/route");

beforeEach(() => {
  resetTestState();
  limitRequest.mockReset();
  limitRequest.mockResolvedValue(null);
});

for (const [name, post] of [
  ["stars", stars],
  ["trybit", trybit],
  ["cardlink", cardlink],
  ["cent", cent],
  ["platega", platega],
] as const) {
  describe(`${name} cart revision`, () => {
    test("rejects a stale displayed cart before invoicing or checking balance", async () => {
      getCartSnapshot.mockResolvedValue({
        revision: crypto.randomUUID(),
        plan: {} as never,
      });
      const response = await post(
        new Request(`http://localhost/api/checkout/${name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cartRevision: crypto.randomUUID() }),
        }),
      );
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ error: "cart_changed" });
      expect(await fakeDb.order.findMany({ where: {} })).toHaveLength(0);
      expect(esimAccessPost).not.toHaveBeenCalled();
    });
    test("requires the displayed cart revision", async () => {
      const response = await post(
        new Request(`http://localhost/api/checkout/${name}`, {
          method: "POST",
          body: "{}",
        }),
      );
      expect(response.status).toBe(400);
      expect(getCartSnapshot).not.toHaveBeenCalled();
    });
  });
}

test("invoice response tracks the order before navigating to a provider", async () => {
  const id = crypto.randomUUID();
  const response = invoiceResponse(id, "https://pay.example/invoice");
  expect(await response.json()).toEqual({
    orderUuid: id,
    invoiceUrl: "https://pay.example/invoice",
  });
  expect(response.headers.get("set-cookie")).toContain(`checkout_order=${id}`);
  expect(response.headers.get("set-cookie")).toContain("HttpOnly");
});

for (const [name, post] of [
  ["stars", stars],
  ["trybit", trybit],
  ["cardlink", cardlink],
  ["cent", cent],
  ["platega", platega],
  ["xhub", xhub],
  ["topup", topup],
] as const) {
  test(`${name} checkout stops before supplier calls or order creation when rate limited`, async () => {
    const revision = crypto.randomUUID();
    getCartSnapshot.mockResolvedValue({ revision, plan: {} as never });
    limitRequest.mockResolvedValue(
      Response.json(
        { error: "rate_limited" },
        { status: 429, headers: { "Retry-After": "60" } },
      ),
    );
    const response = await post(
      new Request(`http://localhost/api/checkout/${name}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          cartRevision: revision,
          locale: "ru",
          paymentMethod: "card",
          orderUuid: crypto.randomUUID(),
          provider: "trybit",
          packageCode: "TOPUP_test",
          userId: "forged-user",
        }),
      }),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("60");
    expect(limitRequest).toHaveBeenCalledWith("user-1", "checkout");
    expect(esimAccessPost).not.toHaveBeenCalled();
    expect(await fakeDb.order.findMany({ where: {} })).toHaveLength(0);
  });
}
