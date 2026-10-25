import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";

import {
  verifyCentChargebackSign,
  verifyCentRefundSign,
  verifyCentSign,
} from "~/server/payments/cent";

const TOKEN = "test-cent-token";

function md5Sign(payload: string): string {
  return createHash("md5")
    .update(`${payload}:${TOKEN}`)
    .digest("hex")
    .toUpperCase();
}

describe("verifyCentSign", () => {
  test("accepts a valid signature", () => {
    expect(
      verifyCentSign({
        outSum: "10.99",
        invId: "order-1",
        signature: md5Sign("10.99:order-1"),
      }),
    ).toBe(true);
  });

  test("accepts a lowercase signature", () => {
    expect(
      verifyCentSign({
        outSum: "10.99",
        invId: "order-1",
        signature: md5Sign("10.99:order-1").toLowerCase(),
      }),
    ).toBe(true);
  });

  test("rejects a wrong signature", () => {
    expect(
      verifyCentSign({
        outSum: "10.99",
        invId: "order-1",
        signature: "0".repeat(32),
      }),
    ).toBe(false);
  });

  test("rejects a signature computed over different values", () => {
    expect(
      verifyCentSign({
        outSum: "99.99",
        invId: "order-1",
        signature: md5Sign("10.99:order-1"),
      }),
    ).toBe(false);
  });
});

describe("verifyCentRefundSign", () => {
  const input = {
    amount: "10.99",
    currency: "USD",
    billId: "BILL-1",
    paymentId: "PAY-1",
    refundId: "REF-1",
  };
  const valid = md5Sign("10.99:USD:BILL-1:PAY-1:REF-1");

  test("accepts a valid signature", () => {
    expect(verifyCentRefundSign({ ...input, signature: valid })).toBe(true);
  });

  test("rejects when a field changes", () => {
    expect(
      verifyCentRefundSign({
        ...input,
        refundId: "REF-2",
        signature: valid,
      }),
    ).toBe(false);
  });
});

describe("verifyCentChargebackSign", () => {
  const input = {
    billId: "BILL-1",
    paymentId: "PAY-1",
    chargebackId: "CB-1",
  };
  const valid = md5Sign("BILL-1:PAY-1:CB-1");

  test("accepts a valid signature", () => {
    expect(verifyCentChargebackSign({ ...input, signature: valid })).toBe(true);
  });

  test("rejects a wrong signature", () => {
    expect(
      verifyCentChargebackSign({ ...input, signature: md5Sign("other") }),
    ).toBe(false);
  });
});
