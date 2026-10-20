import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  retailPriceToRub,
  retailPriceToStars,
  retailPriceToUsd,
} from "~/server/suppliers/esimaccess/packages";
import { fakeDb } from "~/test/fake-db";
import { esimAccessPost, resetTestState } from "~/test/mocks";

const getEsimAccessPackageByCode = mock(
  async (
    _packageCode: string,
  ): Promise<{
    meta: { usdRubRate: number };
    pkg: Record<string, unknown>;
  } | null> => null,
);

void mock.module("~/server/suppliers/esimaccess/packages", () => ({
  ESIMACCESS_SUPPLIER: "esimaccess",
  fetchEsimAccessTopupPackages: async (iccid: string) => {
    const payload = await esimAccessPost<{
      packageList?: Array<Record<string, unknown>>;
    }>("/package/list", {
      locationCode: "",
      type: "TOPUP",
      packageCode: "",
      iccid,
    });
    return payload.obj?.packageList ?? [];
  },
  getEsimAccessPackageByCode,
  retailPriceToRub,
  retailPriceToStars,
  retailPriceToUsd,
}));

const { listTopupOffers, prepareTopupPurchase } = await import(
  "~/server/orders/topup"
);

const DAY_PASS_PKG = {
  packageCode: "PXP1A9DQ8",
  slug: "TR_1_Daily_1Mbps_Premium",
  name: "Turkey 1GB/Day FUP1Mbps Premium",
  retailPrice: 500_000,
  price: 400_000,
  volume: 1024 ** 3,
  duration: 1,
  supportTopUpType: 3,
};

const DATA_PKG = {
  packageCode: "CKH491",
  slug: "CKH491",
  name: "Europe 1GB 7Days",
  retailPrice: 100_000,
  price: 80_000,
  volume: 1024 ** 3,
  duration: 7,
  supportTopUpType: 2,
};

function seedParent(over: Parameters<typeof fakeDb.seedOrder>[0] = {}) {
  fakeDb.seedUser({ id: "user-1", telegramId: "42" });
  return fakeDb.seedOrder({
    userId: "user-1",
    status: "issued",
    paymentStatus: "paid",
    resellerCode: "esimaccess",
    resellerPlanId: DAY_PASS_PKG.packageCode,
    esimIccid: "89000000000000000010",
    esimStatus: "IN_USE",
    ...over,
  });
}

beforeEach(() => {
  resetTestState();
  getEsimAccessPackageByCode.mockReset();
  getEsimAccessPackageByCode.mockResolvedValue(null);
});

describe("listTopupOffers", () => {
  test("day-pass presets use the TOPUP-list slug", async () => {
    const parent = seedParent();
    getEsimAccessPackageByCode.mockResolvedValue({
      meta: { usdRubRate: 90 },
      pkg: DAY_PASS_PKG,
    });
    esimAccessPost.mockResolvedValueOnce({
      success: true,
      obj: {
        packageList: [
          {
            packageCode: "PXP1A9DQ8",
            slug: "TR_1_Daily_1Mbps",
            name: "Turkey day pass",
          },
        ],
      },
    });

    const offers = await listTopupOffers({
      userId: "user-1",
      orderUuid: parent.orderUuid,
    });

    expect(offers).toMatchObject({ mode: "packages", action: "extend" });
    if (offers === "not_found" || offers.mode !== "packages") {
      throw new Error("expected packages");
    }
    expect(offers.packages.map((pkg) => pkg.days)).toEqual([1, 3, 7, 15, 30]);
    expect(
      offers.packages.every((pkg) => pkg.packageCode === "TR_1_Daily_1Mbps"),
    ).toBe(true);
  });

  test("day-pass with no TOPUP-list match offers nothing", async () => {
    const parent = seedParent();
    getEsimAccessPackageByCode.mockResolvedValue({
      meta: { usdRubRate: 90 },
      pkg: DAY_PASS_PKG,
    });
    esimAccessPost.mockResolvedValueOnce({
      success: true,
      obj: { packageList: [{ packageCode: "TOPUP_OTHER", name: "Other" }] },
    });

    const offers = await listTopupOffers({
      userId: "user-1",
      orderUuid: parent.orderUuid,
    });

    expect(offers).toEqual({ mode: "none" });
  });

  test("data top-ups list TOPUP_ packages", async () => {
    const parent = seedParent({ resellerPlanId: DATA_PKG.packageCode });
    getEsimAccessPackageByCode.mockResolvedValue({
      meta: { usdRubRate: 90 },
      pkg: DATA_PKG,
    });
    esimAccessPost.mockResolvedValueOnce({
      success: true,
      obj: {
        packageList: [
          {
            packageCode: "TOPUP_CKH491",
            name: "Europe 1GB 7Days",
            price: 70_000,
            retailPrice: 90_000,
            volume: 1024 ** 3,
            duration: 7,
          },
        ],
      },
    });

    const offers = await listTopupOffers({
      userId: "user-1",
      orderUuid: parent.orderUuid,
    });

    expect(offers).toMatchObject({
      mode: "packages",
      action: "topup",
      packages: [{ packageCode: "TOPUP_CKH491" }],
    });
  });
});

describe("prepareTopupPurchase", () => {
  test("day-pass stores the TOPUP-list code and preset days", async () => {
    const parent = seedParent();
    getEsimAccessPackageByCode.mockResolvedValue({
      meta: { usdRubRate: 90 },
      pkg: DAY_PASS_PKG,
    });
    esimAccessPost.mockResolvedValueOnce({
      success: true,
      obj: {
        packageList: [
          {
            packageCode: "PXP1A9DQ8",
            slug: "TR_1_Daily_1Mbps",
            name: "Turkey day pass",
          },
        ],
      },
    });

    const purchase = await prepareTopupPurchase({
      userId: "user-1",
      orderUuid: parent.orderUuid,
      packageCode: "TR_1_Daily_1Mbps",
      days: 7,
    });

    expect(purchase).not.toBe("invalid");
    expect(purchase).not.toBe("unavailable");
    expect(purchase).not.toBe("not_found");
    if (
      purchase === "invalid" ||
      purchase === "unavailable" ||
      purchase === "not_found"
    ) {
      return;
    }
    expect(purchase.draft.resellerPlanId).toBe("TR_1_Daily_1Mbps");
    expect(purchase.draft.topupPeriodDays).toBe(7);
    expect(purchase.draft.topupOfOrderId).toBe(parent.id);
  });

  test("rejects day-pass days outside the preset set", async () => {
    const parent = seedParent();
    getEsimAccessPackageByCode.mockResolvedValue({
      meta: { usdRubRate: 90 },
      pkg: DAY_PASS_PKG,
    });
    esimAccessPost.mockResolvedValueOnce({
      success: true,
      obj: {
        packageList: [
          {
            packageCode: "PXP1A9DQ8",
            slug: "TR_1_Daily_1Mbps",
          },
        ],
      },
    });

    await expect(
      prepareTopupPurchase({
        userId: "user-1",
        orderUuid: parent.orderUuid,
        packageCode: "TR_1_Daily_1Mbps",
        days: 5,
      }),
    ).resolves.toBe("invalid");
  });

  test("rejects a day-pass packageCode that is not on the TOPUP list", async () => {
    const parent = seedParent();
    getEsimAccessPackageByCode.mockResolvedValue({
      meta: { usdRubRate: 90 },
      pkg: DAY_PASS_PKG,
    });
    esimAccessPost.mockResolvedValueOnce({
      success: true,
      obj: {
        packageList: [
          {
            packageCode: "PXP1A9DQ8",
            slug: "TR_1_Daily_1Mbps",
          },
        ],
      },
    });

    await expect(
      prepareTopupPurchase({
        userId: "user-1",
        orderUuid: parent.orderUuid,
        packageCode: "TR_1_Daily_1Mbps_Premium",
        days: 7,
      }),
    ).resolves.toBe("invalid");
  });
});
