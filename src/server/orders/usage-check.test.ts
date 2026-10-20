import { beforeEach, describe, expect, test } from "bun:test";

import { checkEsimUsage } from "~/server/orders/usage-check";
import { fakeDb } from "~/test/fake-db";
import { esimAccessPost, resetTestState } from "~/test/mocks";

function seedParent(over: Parameters<typeof fakeDb.seedOrder>[0] = {}) {
  fakeDb.seedUser({ id: "user-1", telegramId: "42" });
  return fakeDb.seedOrder({
    userId: "user-1",
    status: "issued",
    paymentStatus: "paid",
    resellerCode: "esimaccess",
    resellerOrderId: "EA-1",
    esimIccid: "890",
    dataTotalBytes: 500n,
    dataUsedBytes: 100n,
    ...over,
  });
}

beforeEach(resetTestState);

describe("checkEsimUsage", () => {
  test("resolves esimTranNo and stores the usage reading, including zero", async () => {
    const parent = seedParent();
    esimAccessPost.mockImplementation(async (path: string) => {
      if (path === "/esim/query") {
        return {
          success: true,
          obj: {
            esimList: [{ iccid: "890", esimTranNo: "26041021130002" }],
          },
        };
      }
      if (path === "/esim/usage/query") {
        return {
          success: true,
          obj: {
            esimUsageList: [
              {
                esimTranNo: "26041021130002",
                dataUsage: 0,
                totalData: 1000,
              },
            ],
          },
        };
      }
      throw new Error(`unexpected path ${path}`);
    });

    const result = await checkEsimUsage({
      userId: "user-1",
      orderUuid: parent.orderUuid,
    });

    expect(result).toEqual({ dataTotalBytes: "1000", dataUsedBytes: "0" });
    expect(esimAccessPost.mock.calls[1]?.[0]).toBe("/esim/usage/query");
    expect(esimAccessPost.mock.calls[1]?.[1]).toEqual({
      esimTranNoList: ["26041021130002"],
    });
    const stored = await fakeDb.order.findUnique({
      where: { id: parent.id },
    });
    expect(stored?.dataTotalBytes).toBe(1000n);
    expect(stored?.dataUsedBytes).toBe(0n);
    expect(stored?.usageSyncedAt).toBeInstanceOf(Date);
  });

  test("returns not_found when the order has no supplier order number", async () => {
    const parent = seedParent({ resellerOrderId: null });

    expect(
      await checkEsimUsage({
        userId: "user-1",
        orderUuid: parent.orderUuid,
      }),
    ).toBe("not_found");
    expect(esimAccessPost.mock.calls).toHaveLength(0);
  });

  test("returns not_found for another user's order", async () => {
    const parent = seedParent();

    expect(
      await checkEsimUsage({
        userId: "user-2",
        orderUuid: parent.orderUuid,
      }),
    ).toBe("not_found");
  });
});
