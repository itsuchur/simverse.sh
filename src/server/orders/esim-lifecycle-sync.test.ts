import { beforeEach, describe, expect, test } from "bun:test";

import { recordEsimSnapshot, syncEsimLifecycleForUser } from "~/server/orders/esim-lifecycle-sync";
import { handleEsimAccessNotification } from "~/server/webhooks/suppliers/esimaccess";
import { fakeDb } from "~/test/fake-db";
import { esimAccessPost, resetTestState, stubEsimAccess } from "~/test/mocks";

const ICCID = "89000000000000000010";

function issuedOrder(
  over: Parameters<typeof fakeDb.seedOrder>[0] = {},
) {
  return fakeDb.seedOrder({
    userId: "user-1",
    status: "issued",
    paymentStatus: "paid",
    resellerOrderId: "EA-1",
    esimIccid: ICCID,
    esimStatus: "IN_USE",
    esimSmdpStatus: "ENABLED",
    ...over,
  });
}

beforeEach(resetTestState);

describe("webhook projection", () => {
  test("DATA_USAGE confirms use and stores the byte pair", async () => {
    const order = issuedOrder();
    const observedAt = new Date("2026-04-12T08:00:00Z");

    await recordEsimSnapshot({
      iccid: ICCID,
      orderNo: "EA-1",
      transactionId: null,
      event: {
        source: "data_usage",
        observedAt,
        totalVolume: 1000,
        orderUsage: 400,
      },
    });

    expect(order.dataTotalBytes).toBe(1000n);
    expect(order.dataUsedBytes).toBe(400n);
    expect(order.usageSyncedAt).toEqual(observedAt);
    expect(order.firstActivatedAt).toBeNull();
  });

  test("VALIDITY_USAGE stores the expiry time and not remain bytes", async () => {
    const order = issuedOrder();
    const observedAt = new Date("2026-04-12T08:00:00Z");

    await recordEsimSnapshot({
      iccid: ICCID,
      orderNo: "EA-1",
      transactionId: null,
      event: {
        source: "validity_usage",
        observedAt,
        expiredTime: "2026-05-01T00:00:00Z",
        remain: 1,
        totalVolume: 1000,
        orderUsage: 10,
      },
    });

    expect(order.expiresAt?.toISOString()).toBe("2026-05-01T00:00:00.000Z");
    expect(order.usageSyncedAt).toEqual(observedAt);
    expect(order.dataUsedBytes).toBeNull();
    expect(order.dataTotalBytes).toBeNull();
  });

  test("an installation webhook does not record first activation", async () => {
    const order = issuedOrder({ esimStatus: null, esimSmdpStatus: "RELEASED" });

    await handleEsimAccessNotification({
      notifyType: "SMDP_EVENT",
      content: {
        iccid: ICCID,
        orderNo: "EA-1",
        esimStatus: "IN_USE",
        smdpStatus: "ENABLED",
        timestamp: "2026-04-12T08:00:00Z",
      },
    });

    expect(order.esimStatus).toBe("IN_USE");
    expect(order.esimSmdpStatus).toBe("ENABLED");
    expect(order.firstActivatedAt).toBeNull();
    expect(order.usageSyncedAt).toBeNull();
  });

  test("a later zero reading does not replace positive usage", async () => {
    const order = issuedOrder({
      dataTotalBytes: 1000n,
      dataUsedBytes: 400n,
    });

    await recordEsimSnapshot({
      iccid: ICCID,
      orderNo: "EA-1",
      transactionId: null,
      event: {
        source: "data_usage",
        observedAt: new Date("2026-04-13T08:00:00Z"),
        totalVolume: 1000,
        orderUsage: 0,
      },
    });

    expect(order.dataUsedBytes).toBe(400n);
    expect(order.usageSyncedAt).toBeNull();
  });
});

describe("webhook history replay", () => {
  test("applies matching logs once, in received order, using the log time", async () => {
    const order = issuedOrder({ esimStatus: null, esimSmdpStatus: "RELEASED" });
    const validityAt = new Date("2026-04-10T00:00:00Z");
    const usageAt = new Date("2026-04-12T00:00:00Z");
    fakeDb.seedWebhookLog({
      receivedAt: usageAt,
      payload: {
        notifyType: "DATA_USAGE",
        content: {
          iccid: ICCID,
          orderNo: "EA-1",
          totalVolume: 1000,
          orderUsage: 250,
        },
      },
    });
    fakeDb.seedWebhookLog({
      receivedAt: validityAt,
      payload: {
        notifyType: "VALIDITY_USAGE",
        content: {
          iccid: ICCID,
          expiredTime: "2026-05-01T00:00:00Z",
          remain: 1,
        },
      },
    });

    await syncEsimLifecycleForUser("user-1");

    expect(order.dataUsedBytes).toBe(250n);
    expect(order.dataTotalBytes).toBe(1000n);
    expect(order.expiresAt?.toISOString()).toBe("2026-05-01T00:00:00.000Z");
    expect(order.usageSyncedAt).toEqual(usageAt);
    expect(order.webhookHistoryAppliedAt).toBeInstanceOf(Date);
    expect(esimAccessPost).not.toHaveBeenCalled();

    fakeDb.seedWebhookLog({
      receivedAt: new Date("2026-04-13T00:00:00Z"),
      payload: {
        notifyType: "ESIM_STATUS",
        content: { iccid: ICCID, esimStatus: "USED_UP" },
      },
    });
    await syncEsimLifecycleForUser("user-1");
    expect(order.esimStatus).toBeNull();
    expect(order.dataUsedBytes).toBe(250n);
  });
});

describe("activation fallback", () => {
  test("does not query without an install signal or after webhook confirmation", async () => {
    issuedOrder({
      esimStatus: null,
      esimSmdpStatus: "RELEASED",
      webhookHistoryAppliedAt: new Date("2026-04-01T00:00:00Z"),
    });
    const confirmed = issuedOrder({
      orderUuid: crypto.randomUUID(),
      resellerOrderId: "EA-2",
      esimIccid: "89000000000000000011",
      dataUsedBytes: 10n,
      webhookHistoryAppliedAt: new Date("2026-04-01T00:00:00Z"),
    });
    stubEsimAccess({ profiles: [] });

    await syncEsimLifecycleForUser("user-1");

    expect(esimAccessPost).not.toHaveBeenCalled();
    expect(confirmed.firstActivatedAt).toBeNull();
  });

  test("queries once for an ambiguous install and keeps activation time", async () => {
    const order = issuedOrder({
      webhookHistoryAppliedAt: new Date("2026-04-01T00:00:00Z"),
      expiresAt: new Date("2026-06-01T00:00:00Z"),
    });
    stubEsimAccess({
      profiles: [
        {
          iccid: ICCID,
          esimStatus: "IN_USE",
          smdpStatus: "ENABLED",
          totalVolume: 1000,
          orderUsage: 0,
        },
      ],
    });

    await syncEsimLifecycleForUser("user-1");

    expect(esimAccessPost).toHaveBeenCalledTimes(1);
    expect(order.firstActivatedAt).toBeNull();
    expect(order.dataUsedBytes).toBe(0n);
    expect(order.expiresAt?.toISOString()).toBe("2026-06-01T00:00:00.000Z");
    expect(order.activationCheckedAt).toBeInstanceOf(Date);

    esimAccessPost.mockClear();
    await syncEsimLifecycleForUser("user-1");
    expect(esimAccessPost).not.toHaveBeenCalled();
  });

  test("stores activateTime from the fallback query", async () => {
    const order = issuedOrder({
      webhookHistoryAppliedAt: new Date("2026-04-01T00:00:00Z"),
    });
    stubEsimAccess({
      profiles: [
        {
          iccid: ICCID,
          esimStatus: "IN_USE",
          smdpStatus: "ENABLED",
          activateTime: "2026-04-10T21:13:01+0000",
          totalVolume: 1000,
          orderUsage: 100,
          expiredTime: "2026-05-10T21:13:01+0000",
        },
      ],
    });

    await syncEsimLifecycleForUser("user-1");

    expect(order.firstActivatedAt?.toISOString()).toBe(
      "2026-04-10T21:13:01.000Z",
    );
    expect(order.dataUsedBytes).toBe(100n);
    expect(order.expiresAt?.toISOString()).toBe("2026-05-10T21:13:01.000Z");
  });

  test("a failed query leaves the stored row and retry marker unchanged", async () => {
    const order = issuedOrder({
      webhookHistoryAppliedAt: new Date("2026-04-01T00:00:00Z"),
      dataTotalBytes: 1000n,
      dataUsedBytes: null,
    });

    await syncEsimLifecycleForUser("user-1");

    expect(order.activationCheckedAt).toBeNull();
    expect(order.dataTotalBytes).toBe(1000n);
    expect(order.firstActivatedAt).toBeNull();
  });

  test("an empty profile list records the check and does not invent activation", async () => {
    const order = issuedOrder({
      webhookHistoryAppliedAt: new Date("2026-04-01T00:00:00Z"),
    });
    stubEsimAccess({ profiles: [] });

    await syncEsimLifecycleForUser("user-1");

    expect(esimAccessPost).toHaveBeenCalledTimes(1);
    expect(order.firstActivatedAt).toBeNull();
    expect(order.esimStatus).toBe("IN_USE");
    expect(order.activationCheckedAt).toBeInstanceOf(Date);
  });
});
