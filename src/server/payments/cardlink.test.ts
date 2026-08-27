import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";

import {
  verifyCardlinkChargebackSign,
  verifyCardlinkRefundSign,
  verifyCardlinkSign,
} from "~/server/payments/cardlink";

const TOKEN = "test-cardlink-token";

function md5Sign(payload: string): string {
  return createHash("md5")
    .update(`${payload}:${TOKEN}`)
    .digest("hex")
    .toUpperCase();
}

describe("verifyCardlinkSign", () => {
  test("accepts a valid signature", () => {
    expect(
      verifyCardlinkSign({
        outSum: "10.99",
        invId: "order-1",
        signature: md5Sign("10.99:order-1"),
      }),
    ).toBe(true);
  });

  test("accepts a lowercase signature", () => {
    expect(
      verifyCardlinkSign({
        outSum: "10.99",
        invId: "order-1",
        signature: md5Sign("10.99:order-1").toLowerCase(),
      }),
    ).toBe(true);
  });

  test("rejects a wrong signature", () => {
    expect(
      verifyCardlinkSign({
        outSum: "10.99",
        invId: "order-1",
        signature: "0".repeat(32),
      }),
    ).toBe(false);
  });

  test("rejects a signature computed over different values", () => {
    expect(
      verifyCardlinkSign({
        outSum: "99.99",
        invId: "order-1",
        signature: md5Sign("10.99:order-1"),
      }),
    ).toBe(false);
  });
});

describe("verifyCardlinkRefundSign", () => {
  const input = {
    amount: "10.99",
    currency: "USD",
    billId: "BILL-1",
    paymentId: "PAY-1",
    refundId: "REF-1",
  };
  const valid = md5Sign("10.99:USD:BILL-1:PAY-1:REF-1");

  test("accepts a valid signature", () => {
    expect(verifyCardlinkRefundSign({ ...input, signature: valid })).toBe(true);
  });

  test("rejects when a field changes", () => {
    expect(
      verifyCardlinkRefundSign({ ...input, refundId: "REF-2", signature: valid }),
    ).toBe(false);
  });
});

describe("verifyCardlinkChargebackSign", () => {
  const input = {
    billId: "BILL-1",
    paymentId: "PAY-1",
    chargebackId: "CB-1",
  };
  const valid = md5Sign("BILL-1:PAY-1:CB-1");

  test("accepts a valid signature", () => {
    expect(verifyCardlinkChargebackSign({ ...input, signature: valid })).toBe(
      true,
    );
  });

  test("rejects a wrong signature", () => {
    expect(
      verifyCardlinkChargebackSign({ ...input, signature: md5Sign("other") }),
    ).toBe(false);
  });
});
