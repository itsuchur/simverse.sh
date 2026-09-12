import { expect, test } from "bun:test";
import { needsDeliveryRefresh } from "./order-delivery";

test("keeps refreshing through delayed payment and partial provisioning", () => {
  const order = {
    paymentStatus: "pending",
    esimIccid: null as string | null,
    esimActivationCode: null as string | null,
  };
  expect(needsDeliveryRefresh(order)).toBe(true);
  order.paymentStatus = "paid";
  expect(needsDeliveryRefresh(order)).toBe(true);
  order.esimIccid = "890123";
  expect(needsDeliveryRefresh(order)).toBe(true);
  order.esimActivationCode = "LPA:1$rsp.example.com$code";
  expect(needsDeliveryRefresh(order)).toBe(false);
});

test("a reversed payment no longer waits for delivery", () => {
  for (const paymentStatus of ["refunded", "chargeback", "failed"]) {
    expect(needsDeliveryRefresh({ paymentStatus, esimIccid: null })).toBe(
      false,
    );
  }
});
