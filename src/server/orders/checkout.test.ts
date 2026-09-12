import { beforeEach, describe, expect, mock, test } from "bun:test";
import { fakeDb } from "~/test/fake-db";
import { esimAccessPost, getCartSnapshot, resetTestState } from "~/test/mocks";
import { invoiceResponse } from "./checkout";

void mock.module("~/server/better-auth", () => ({
  auth: {
    api: {
      getSession: async () => ({ user: { id: "user-1", telegramId: "42" } }),
    },
  },
}));
void mock.module("~/server/sales", () => ({ isSalesActive: async () => true }));

const { POST: stars } = await import("~/app/api/checkout/stars/route");
const { POST: trybit } = await import("~/app/api/checkout/trybit/route");
const { POST: cardlink } = await import("~/app/api/checkout/cardlink/route");

beforeEach(resetTestState);

for (const [name, post] of [
  ["stars", stars],
  ["trybit", trybit],
  ["cardlink", cardlink],
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
