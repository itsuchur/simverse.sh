import { beforeEach, describe, expect, test } from "bun:test";

import {
  applyEsimStatus,
  attachGotResource,
  failTrybitPayment,
  fulfillCardlinkPayment,
  fulfillStarsPayment,
  fulfillTrybitPayment,
  markCardlinkChargeback,
  markCardlinkRefunded,
  placeSupplierOrder,
  syncPendingProfilesForUser,
} from "~/server/orders/fulfill";
import { fakeDb } from "~/test/fake-db";
import {
  capturedEvents,
  clearCart,
  esimAccessPost,
  esimOrderCallCount,
  resetTestState,
  sentryCaptureException,
  sentryCaptureMessage,
  stubEsimAccess,
} from "~/test/mocks";

const PROFILE = {
  iccid: "89000000000000000010",
  ac: "LPA:1$rsp.example.com$STARS1",
  qrCodeUrl: "https://qr.example/10",
  smdpAddress: "rsp.example.com",
  esimStatus: "GOT_RESOURCE",
  smdpStatus: "RELEASED",
};

function seedStarsOrder(over: Parameters<typeof fakeDb.seedOrder>[0] = {}) {
  fakeDb.seedUser({ id: "user-1", telegramId: "42" });
  return fakeDb.seedOrder({
    paymentProvider: "telegram_stars",
    currency: "XTR",
    priceAmount: 370n,
    ...over,
  });
}

beforeEach(resetTestState);

describe("fulfillStarsPayment", () => {
  test("walks a pending order to issued and clears the cart", async () => {
    const order = seedStarsOrder();
    stubEsimAccess({ orderNo: "EA-1", profiles: [PROFILE] });

    await fulfillStarsPayment({
      orderUuid: order.orderUuid,
      telegramPaymentChargeId: "tg-charge-1",
      telegramId: "42",
      totalAmount: 370,
      currency: "XTR",
    });

    expect(order.paymentStatus).toBe("paid");
    expect(order.paymentChargeId).toBe("tg-charge-1");
    expect(order.status).toBe("issued");
    expect(order.resellerOrderId).toBe("EA-1");
    expect(order.esimIccid).toBe(PROFILE.iccid);
    expect(clearCart).toHaveBeenCalledWith("42");
    expect(capturedEvents()).toEqual(["order_paid", "esim_issued"]);
  });

  test("replaying the same charge does not order twice", async () => {
    const order = seedStarsOrder();
    stubEsimAccess({ orderNo: "EA-1", profiles: [PROFILE] });

    const input = {
      orderUuid: order.orderUuid,
      telegramPaymentChargeId: "tg-charge-1",
      telegramId: "42",
      totalAmount: 370,
      currency: "XTR",
    };
    await fulfillStarsPayment(input);
    await fulfillStarsPayment(input);

    expect(esimOrderCallCount()).toBe(1);
    expect(order.status).toBe("issued");
    expect(capturedEvents()).toEqual(["order_paid", "esim_issued"]);
  });

  test("a second, different charge for a paid order raises an alert", async () => {
    const order = seedStarsOrder();
    stubEsimAccess({ orderNo: "EA-1", profiles: [PROFILE] });

    await fulfillStarsPayment({
      orderUuid: order.orderUuid,
      telegramPaymentChargeId: "tg-charge-1",
      telegramId: "42",
      totalAmount: 370,
      currency: "XTR",
    });
    await fulfillStarsPayment({
      orderUuid: order.orderUuid,
      telegramPaymentChargeId: "tg-charge-2",
      telegramId: "42",
      totalAmount: 370,
      currency: "XTR",
    });

    expect(order.paymentChargeId).toBe("tg-charge-1");
    expect(sentryCaptureMessage.mock.calls[0]?.[0]).toBe(
      "Duplicate payment charge for already-paid order",
    );
  });

  test("supersedes other pending drafts for the same plan", async () => {
    const order = seedStarsOrder({ resellerPlanId: "PKG-9" });
    const draft = seedStarsOrder({ resellerPlanId: "PKG-9" });
    stubEsimAccess({ profiles: [PROFILE] });

    await fulfillStarsPayment({
      orderUuid: order.orderUuid,
      telegramPaymentChargeId: "tg-charge-1",
      telegramId: "42",
      totalAmount: 370,
      currency: "XTR",
    });

    expect(draft.status).toBe("failed");
    expect(draft.paymentStatus).toBe("failed");
    expect(draft.failureReason).toBe("superseded");
  });

  test("Stars amount or currency mismatch keeps the order pending and alerts", async () => {
    const order = seedStarsOrder();

    await fulfillStarsPayment({
      orderUuid: order.orderUuid,
      telegramPaymentChargeId: "tg-charge-1",
      telegramId: "42",
      totalAmount: 1,
      currency: "XTR",
    });

    expect(order.paymentStatus).toBe("pending");
    expect(esimOrderCallCount()).toBe(0);
    expect(sentryCaptureMessage.mock.calls[0]?.[0]).toBe(
      "Telegram Stars payment amount mismatch",
    );
  });

  test("unknown order or provider mismatch is a no-op", async () => {
    const order = seedStarsOrder();

    await fulfillStarsPayment({
      orderUuid: crypto.randomUUID(),
      telegramPaymentChargeId: "tg-x",
      telegramId: "42",
      totalAmount: 370,
      currency: "XTR",
    });
    await fulfillTrybitPayment({
      orderUuid: order.orderUuid,
      invoiceUuid: "INV-1",
      amountUsd: 3.7,
    });

    expect(order.paymentStatus).toBe("pending");
    expect(order.status).toBe("created");
  });
});

describe("payment validation", () => {
  test("Trybit amount mismatch keeps the order pending", async () => {
    fakeDb.seedUser({ id: "user-1", telegramId: "42" });
    const order = fakeDb.seedOrder({ priceAmount: 1099n });

    await fulfillTrybitPayment({
      orderUuid: order.orderUuid,
      invoiceUuid: "INV-1",
      amountUsd: 5,
    });

    expect(order.paymentStatus).toBe("pending");
    expect(sentryCaptureMessage.mock.calls[0]?.[0]).toBe(
      "Trybit webhook amount mismatch",
    );
    expect(esimOrderCallCount()).toBe(0);
  });

  test("Cardlink amount mismatch keeps the order pending", async () => {
    fakeDb.seedUser({ id: "user-1", telegramId: "42" });
    const order = fakeDb.seedOrder({
      paymentProvider: "cardlink",
      priceAmount: 1099n,
      currency: "USD",
    });

    await fulfillCardlinkPayment({
      orderUuid: order.orderUuid,
      billId: "BILL-1",
      amount: "not-a-number",
      currency: "usd",
    });

    expect(order.paymentStatus).toBe("pending");
    expect(sentryCaptureMessage.mock.calls[0]?.[0]).toBe(
      "Cardlink webhook amount mismatch",
    );
  });
});

describe("payment arriving after the draft was closed", () => {
  test("a superseded draft that gets paid is still fulfilled and flagged", async () => {
    fakeDb.seedUser({ id: "user-1", telegramId: "42" });
    const order = fakeDb.seedOrder({
      priceAmount: 1099n,
      status: "failed",
      paymentStatus: "failed",
      failureReason: "superseded",
    });
    stubEsimAccess({ orderNo: "EA-1", profiles: [PROFILE] });

    await fulfillTrybitPayment({
      orderUuid: order.orderUuid,
      invoiceUuid: "INV-1",
      amountUsd: 10.99,
    });

    expect(order.paymentStatus).toBe("paid");
    expect(order.paymentChargeId).toBe("INV-1");
    expect(order.status).toBe("issued");
    expect(order.failureReason).toBeNull();
    expect(sentryCaptureMessage.mock.calls[0]?.[0]).toBe(
      "Payment received for a failed order; fulfilling",
    );
  });

  test("a success callback after a fail callback still fulfills", async () => {
    fakeDb.seedUser({ id: "user-1", telegramId: "42" });
    const order = fakeDb.seedOrder({ priceAmount: 1099n });
    stubEsimAccess({ orderNo: "EA-1", profiles: [PROFILE] });

    await failTrybitPayment(order.orderUuid);
    expect(order.status).toBe("failed");

    await fulfillTrybitPayment({
      orderUuid: order.orderUuid,
      invoiceUuid: "INV-1",
      amountUsd: 10.99,
    });

    expect(order.paymentStatus).toBe("paid");
    expect(order.status).toBe("issued");
  });

  test("refunded or charged-back orders never accept a new charge", async () => {
    fakeDb.seedUser({ id: "user-1", telegramId: "42" });
    const order = fakeDb.seedOrder({
      priceAmount: 1099n,
      status: "issued",
      paymentStatus: "refunded",
      paymentChargeId: "INV-0",
    });

    await fulfillTrybitPayment({
      orderUuid: order.orderUuid,
      invoiceUuid: "INV-1",
      amountUsd: 10.99,
    });

    expect(order.paymentStatus).toBe("refunded");
    expect(order.paymentChargeId).toBe("INV-0");
  });
});

describe("supplier order overlapping a webhook", () => {
  test("keeps the webhook-attached supplier order and alerts on the duplicate", async () => {
    fakeDb.seedUser({ id: "user-1", telegramId: "42" });
    const order = fakeDb.seedOrder({ status: "paid", paymentStatus: "paid" });
    esimAccessPost.mockImplementation(async (path: string) => {
      if (path === "/esim/order") {
        // A GOT_RESOURCE webhook lands while our order request is in flight.
        order.resellerOrderId = "EA-WEBHOOK";
        return { success: true, obj: { orderNo: "EA-LATE" } };
      }
      return { success: true, obj: { esimList: [PROFILE] } };
    });

    await placeSupplierOrder(order);

    expect(order.resellerOrderId).toBe("EA-WEBHOOK");
    expect(order.status).toBe("issued");
    expect(sentryCaptureMessage.mock.calls[0]?.[0]).toBe(
      "Duplicate supplier order for one paid order",
    );
  });

  test("a supplier error does not fail an order that already has a supplier order", async () => {
    fakeDb.seedUser({ id: "user-1", telegramId: "42" });
    const order = fakeDb.seedOrder({ status: "paid", paymentStatus: "paid" });
    esimAccessPost.mockImplementation(async () => {
      order.resellerOrderId = "EA-WEBHOOK";
      throw new Error("duplicate transactionId");
    });

    await placeSupplierOrder(order);

    expect(order.status).toBe("ordering");
    expect(order.resellerOrderId).toBe("EA-WEBHOOK");
  });

  test("attachGotResource recovers an order marked failed after payment", async () => {
    fakeDb.seedUser({ id: "user-1", telegramId: "42" });
    const order = fakeDb.seedOrder({
      status: "failed",
      paymentStatus: "paid",
      failureReason: "supplier down",
    });
    stubEsimAccess({ profiles: [PROFILE] });

    await attachGotResource({
      orderNo: "EA-9",
      transactionId: order.orderUuid,
    });

    expect(order.resellerOrderId).toBe("EA-9");
    expect(order.status).toBe("issued");
  });
});

describe("supplier order failure", () => {
  test("marks the order failed and captures the exception", async () => {
    const order = seedStarsOrder();
    esimAccessPost.mockImplementation(async () => {
      throw new Error("supplier down");
    });

    await fulfillStarsPayment({
      orderUuid: order.orderUuid,
      telegramPaymentChargeId: "tg-charge-1",
      telegramId: "42",
      totalAmount: 370,
      currency: "XTR",
    });

    expect(order.paymentStatus).toBe("paid");
    expect(order.status).toBe("failed");
    expect(order.failureReason).toBe("supplier down");
    expect(sentryCaptureException).toHaveBeenCalled();
    expect(capturedEvents()).toEqual(["order_paid", "esim_issue_failed"]);
  });
});

describe("failTrybitPayment", () => {
  test("fails only a pending order", async () => {
    const pending = fakeDb.seedOrder({});
    const paid = fakeDb.seedOrder({
      paymentStatus: "paid",
      status: "paid",
      paymentChargeId: "INV-1",
    });

    await failTrybitPayment(pending.orderUuid);
    await failTrybitPayment(paid.orderUuid);

    expect(pending.status).toBe("failed");
    expect(pending.failureReason).toBe("payment_failed");
    expect(paid.status).toBe("paid");
    expect(paid.paymentStatus).toBe("paid");
  });
});

describe("markCardlinkRefunded / markCardlinkChargeback", () => {
  function seedPaidCardlink() {
    return fakeDb.seedOrder({
      paymentProvider: "cardlink",
      paymentStatus: "paid",
      status: "issued",
      priceAmount: 1099n,
      currency: "USD",
    });
  }

  test("refund stores the refunded amount in cents", async () => {
    const order = seedPaidCardlink();

    await markCardlinkRefunded({
      orderUuid: order.orderUuid,
      refundId: "REF-1",
      amount: "10.99",
      currency: "usd",
    });

    expect(order.paymentStatus).toBe("refunded");
    expect(order.refundedAmount).toBe(1099n);
  });

  test("refund with an unparseable amount is ignored", async () => {
    const order = seedPaidCardlink();

    await markCardlinkRefunded({
      orderUuid: order.orderUuid,
      refundId: "REF-1",
      amount: "abc",
      currency: "USD",
    });

    expect(order.paymentStatus).toBe("paid");
  });

  test("chargeback applies to paid and refunded orders and replays safely", async () => {
    const order = seedPaidCardlink();
    order.paymentStatus = "refunded";
    order.paymentRefundId = "REF-1";

    await markCardlinkChargeback({
      orderUuid: order.orderUuid,
      chargebackId: "CB-1",
    });
    await markCardlinkChargeback({
      orderUuid: order.orderUuid,
      chargebackId: "CB-1",
    });

    expect(order.paymentStatus).toBe("chargeback");
    expect(order.paymentChargebackId).toBe("CB-1");
  });
});

describe("placeSupplierOrder claiming", () => {
  test("reclaims a stale ordering claim", async () => {
    const order = fakeDb.seedOrder({
      status: "ordering",
      paymentStatus: "paid",
      updatedAt: new Date(Date.now() - 10 * 60_000),
    });
    stubEsimAccess({ orderNo: "EA-STALE", profiles: [PROFILE] });

    await placeSupplierOrder(order);

    expect(order.resellerOrderId).toBe("EA-STALE");
    expect(order.status).toBe("issued");
  });

  test("does not steal a fresh ordering claim", async () => {
    const order = fakeDb.seedOrder({
      status: "ordering",
      paymentStatus: "paid",
    });

    await placeSupplierOrder(order);

    expect(order.status).toBe("ordering");
    expect(esimOrderCallCount()).toBe(0);
  });

  test("does not reclaim while a supplier request can still be in flight", async () => {
    const order = fakeDb.seedOrder({
      status: "ordering",
      paymentStatus: "paid",
      updatedAt: new Date(Date.now() - 120_000),
    });

    await placeSupplierOrder(order);

    expect(esimOrderCallCount()).toBe(0);
  });
});

describe("delivery sync", () => {
  test("syncPendingProfilesForUser issues profiles and places missing supplier orders", async () => {
    fakeDb.seedUser({ id: "user-1", telegramId: "42" });
    const withSupplierOrder = fakeDb.seedOrder({
      status: "ordering",
      paymentStatus: "paid",
      resellerOrderId: "EA-7",
    });
    const withoutSupplierOrder = fakeDb.seedOrder({
      status: "paid",
      paymentStatus: "paid",
    });
    stubEsimAccess({ orderNo: "EA-8", profiles: [PROFILE] });

    await syncPendingProfilesForUser("user-1");

    expect(withSupplierOrder.status).toBe("issued");
    expect(withoutSupplierOrder.status).toBe("issued");
    expect(withoutSupplierOrder.resellerOrderId).toBe("EA-8");
    expect(esimOrderCallCount()).toBe(1);
  });

  test("order stays paid when the supplier has no profile yet", async () => {
    const order = fakeDb.seedOrder({
      status: "paid",
      paymentStatus: "paid",
      resellerOrderId: "EA-7",
    });
    stubEsimAccess({ profiles: [] });

    await syncPendingProfilesForUser("user-1");

    expect(order.status).toBe("paid");
    expect(order.esimIccid).toBeNull();
  });

  test("attachGotResource adopts the supplier orderNo and issues", async () => {
    fakeDb.seedUser({ id: "user-1", telegramId: "42" });
    const order = fakeDb.seedOrder({ status: "paid", paymentStatus: "paid" });
    stubEsimAccess({ profiles: [PROFILE] });

    await attachGotResource({
      orderNo: "EA-9",
      transactionId: order.orderUuid,
    });

    expect(order.resellerOrderId).toBe("EA-9");
    expect(order.status).toBe("issued");
    expect(order.esimIccid).toBe(PROFILE.iccid);
  });

  test("attachGotResource finds the order by reseller orderNo", async () => {
    fakeDb.seedUser({ id: "user-1", telegramId: "42" });
    const order = fakeDb.seedOrder({
      status: "ordering",
      paymentStatus: "paid",
      resellerOrderId: "EA-10",
    });
    stubEsimAccess({ profiles: [PROFILE] });

    await attachGotResource({ orderNo: "EA-10", transactionId: null });

    expect(order.status).toBe("issued");
  });

  test("attachGotResource with no matching order is a no-op", async () => {
    await attachGotResource({
      orderNo: "EA-NOPE",
      transactionId: crypto.randomUUID(),
    });
    expect(esimAccessPost).not.toHaveBeenCalled();
  });
});

describe("applyEsimStatus", () => {
  test("updates lifecycle and SM-DP status by ICCID", async () => {
    const order = fakeDb.seedOrder({
      status: "issued",
      esimIccid: PROFILE.iccid,
    });

    await applyEsimStatus({
      iccid: PROFILE.iccid,
      orderNo: null,
      transactionId: null,
      esimStatus: "IN_USE",
      smdpStatus: "ENABLED",
    });

    expect(order.esimStatus).toBe("IN_USE");
    expect(order.esimSmdpStatus).toBe("ENABLED");
  });

  test("ignores non-lifecycle statuses but keeps the SM-DP update", async () => {
    const order = fakeDb.seedOrder({
      status: "issued",
      esimIccid: PROFILE.iccid,
      esimStatus: "IN_USE",
    });

    await applyEsimStatus({
      iccid: PROFILE.iccid,
      orderNo: null,
      transactionId: null,
      esimStatus: "SOMETHING_NEW",
      smdpStatus: "DISABLED",
    });

    expect(order.esimStatus).toBe("IN_USE");
    expect(order.esimSmdpStatus).toBe("DISABLED");
  });

  test("backfills a missing ICCID when matched by orderNo", async () => {
    const order = fakeDb.seedOrder({
      status: "ordering",
      paymentStatus: "paid",
      resellerOrderId: "EA-11",
    });

    await applyEsimStatus({
      iccid: "89000000000000000099",
      orderNo: "EA-11",
      transactionId: null,
      esimStatus: "NOT_ACTIVE",
      smdpStatus: null,
    });

    expect(order.esimIccid).toBe("89000000000000000099");
    expect(order.esimStatus).toBe("NOT_ACTIVE");
  });

  test("no matching order is a no-op", async () => {
    await applyEsimStatus({
      iccid: "000",
      orderNo: null,
      transactionId: null,
      esimStatus: "IN_USE",
      smdpStatus: null,
    });
  });
});
