import { beforeEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";

import {
  handleCardlinkChargebackWebhook,
  handleCardlinkRefundWebhook,
  handleCardlinkWebhook,
} from "~/server/webhooks/payments/cardlink";
import { fakeDb } from "~/test/fake-db";
import {
  resetTestState,
  sentryCaptureMessage,
  stubEsimAccess,
} from "~/test/mocks";

const TOKEN = "test-cardlink-token";

function md5Sign(payload: string): string {
  return createHash("md5")
    .update(`${payload}:${TOKEN}`)
    .digest("hex")
    .toUpperCase();
}

function postForm(fields: Record<string, string>): Request {
  return new Request("http://localhost/api/webhooks/payments/cardlink", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields).toString(),
  });
}

const PROFILE = {
  iccid: "89000000000000000002",
  ac: "LPA:1$rsp.example.com$XYZ789",
  qrCodeUrl: "https://qr.example/2",
  smdpAddress: "rsp.example.com",
  smdpStatus: "RELEASED",
};

function seedPendingCardlinkOrder() {
  fakeDb.seedUser({ id: "user-1", telegramId: "42" });
  return fakeDb.seedOrder({
    paymentProvider: "cardlink",
    priceAmount: 1099n,
    currency: "USD",
  });
}

describe("handleCardlinkWebhook", () => {
  beforeEach(resetTestState);

  test("SUCCESS postback fulfills the order", async () => {
    const order = seedPendingCardlinkOrder();
    stubEsimAccess({ orderNo: "EA-2", profiles: [PROFILE] });

    const response = await handleCardlinkWebhook(
      postForm({
        InvId: order.orderUuid,
        OutSum: "10.99",
        TrsId: "BILL-1",
        Status: "SUCCESS",
        CurrencyIn: "USD",
        SignatureValue: md5Sign(`10.99:${order.orderUuid}`),
      }),
    );

    expect(response.status).toBe(200);
    expect(order.paymentStatus).toBe("paid");
    expect(order.paymentChargeId).toBe("BILL-1");
    expect(order.status).toBe("issued");
    expect(order.esimIccid).toBe(PROFILE.iccid);
    expect(fakeDb.webhookLogs[0]?.source).toBe("cardlink");
  });

  test("invalid signature returns 401", async () => {
    const order = seedPendingCardlinkOrder();

    const response = await handleCardlinkWebhook(
      postForm({
        InvId: order.orderUuid,
        OutSum: "10.99",
        TrsId: "BILL-1",
        Status: "SUCCESS",
        CurrencyIn: "USD",
        SignatureValue: "0".repeat(32),
      }),
    );

    expect(response.status).toBe(401);
    expect(order.paymentStatus).toBe("pending");
  });

  test("currency mismatch keeps the order pending and alerts", async () => {
    const order = seedPendingCardlinkOrder();

    const response = await handleCardlinkWebhook(
      postForm({
        InvId: order.orderUuid,
        OutSum: "10.99",
        TrsId: "BILL-1",
        Status: "SUCCESS",
        CurrencyIn: "RUB",
        SignatureValue: md5Sign(`10.99:${order.orderUuid}`),
      }),
    );

    expect(response.status).toBe(200);
    expect(order.paymentStatus).toBe("pending");
    expect(sentryCaptureMessage.mock.calls[0]?.[0]).toBe(
      "Cardlink webhook currency mismatch",
    );
  });

  test("amount mismatch keeps the order pending and alerts", async () => {
    const order = seedPendingCardlinkOrder();

    const response = await handleCardlinkWebhook(
      postForm({
        InvId: order.orderUuid,
        OutSum: "9.99",
        TrsId: "BILL-1",
        Status: "SUCCESS",
        CurrencyIn: "USD",
        SignatureValue: md5Sign(`9.99:${order.orderUuid}`),
      }),
    );

    expect(response.status).toBe(200);
    expect(order.paymentStatus).toBe("pending");
    expect(sentryCaptureMessage.mock.calls[0]?.[0]).toBe(
      "Cardlink webhook amount mismatch",
    );
  });

  test("FAIL postback fails the pending order", async () => {
    const order = seedPendingCardlinkOrder();

    const response = await handleCardlinkWebhook(
      postForm({
        InvId: order.orderUuid,
        OutSum: "10.99",
        TrsId: "BILL-1",
        Status: "FAIL",
        CurrencyIn: "USD",
        SignatureValue: md5Sign(`10.99:${order.orderUuid}`),
      }),
    );

    expect(response.status).toBe(200);
    expect(order.status).toBe("failed");
    expect(order.paymentStatus).toBe("failed");
  });

  test("non-object JSON body returns 400", async () => {
    const response = await handleCardlinkWebhook(
      new Request("http://localhost/webhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify([]),
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe("handleCardlinkRefundWebhook", () => {
  beforeEach(resetTestState);

  function seedPaidOrder() {
    fakeDb.seedUser({ id: "user-1", telegramId: "42" });
    return fakeDb.seedOrder({
      paymentProvider: "cardlink",
      priceAmount: 1099n,
      currency: "USD",
      paymentStatus: "paid",
      status: "issued",
      paymentChargeId: "BILL-1",
    });
  }

  function refundForm(
    order: { orderUuid: string },
    over?: Record<string, string>,
  ) {
    const fields = {
      Id: "REF-1",
      Amount: "10.99",
      Currency: "USD",
      Status: "SUCCESS",
      InvId: order.orderUuid,
      BillId: "BILL-1",
      PaymentId: "PAY-1",
      ...over,
    };
    return postForm({
      ...fields,
      SignatureValue:
        over?.SignatureValue ??
        md5Sign(
          `${fields.Amount}:${fields.Currency}:${fields.BillId}:${fields.PaymentId}:${fields.Id}`,
        ),
    });
  }

  test("successful refund marks the order refunded", async () => {
    const order = seedPaidOrder();

    const response = await handleCardlinkRefundWebhook(refundForm(order));

    expect(response.status).toBe(200);
    expect(order.paymentStatus).toBe("refunded");
    expect(order.paymentRefundId).toBe("REF-1");
    expect(order.refundedAmount).toBe(1099n);
  });

  test("refund replay with the same id stays refunded", async () => {
    const order = seedPaidOrder();
    await handleCardlinkRefundWebhook(refundForm(order));
    const response = await handleCardlinkRefundWebhook(refundForm(order));

    expect(response.status).toBe(200);
    expect(order.paymentStatus).toBe("refunded");
    expect(order.paymentRefundId).toBe("REF-1");
  });

  test("second refund with a different id does not overwrite", async () => {
    const order = seedPaidOrder();
    await handleCardlinkRefundWebhook(refundForm(order));
    await handleCardlinkRefundWebhook(refundForm(order, { Id: "REF-2" }));

    expect(order.paymentRefundId).toBe("REF-1");
  });

  test("invalid signature returns 401", async () => {
    const order = seedPaidOrder();
    const response = await handleCardlinkRefundWebhook(
      refundForm(order, { SignatureValue: "0".repeat(32) }),
    );

    expect(response.status).toBe(401);
    expect(order.paymentStatus).toBe("paid");
  });
});

describe("handleCardlinkChargebackWebhook", () => {
  beforeEach(resetTestState);

  function chargebackForm(order: { orderUuid: string }) {
    return postForm({
      Id: "CB-1",
      Status: "SUCCESS",
      InvId: order.orderUuid,
      BillId: "BILL-1",
      PaymentId: "PAY-1",
      SignatureValue: md5Sign("BILL-1:PAY-1:CB-1"),
    });
  }

  test("chargeback marks a paid order", async () => {
    const order = fakeDb.seedOrder({
      paymentProvider: "cardlink",
      paymentStatus: "paid",
      status: "issued",
    });

    const response = await handleCardlinkChargebackWebhook(
      chargebackForm(order),
    );

    expect(response.status).toBe(200);
    expect(order.paymentStatus).toBe("chargeback");
    expect(order.paymentChargebackId).toBe("CB-1");
  });

  test("chargeback also applies to an already refunded order", async () => {
    const order = fakeDb.seedOrder({
      paymentProvider: "cardlink",
      paymentStatus: "refunded",
      status: "issued",
      paymentRefundId: "REF-1",
    });

    await handleCardlinkChargebackWebhook(chargebackForm(order));

    expect(order.paymentStatus).toBe("chargeback");
  });
});
