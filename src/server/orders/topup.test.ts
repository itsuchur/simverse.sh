import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  exceedsEsimAccessProvisionCost,
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
  exceedsEsimAccessProvisionCost,
  fetchEsimAccessTopupPackages: async (iccid: string) => {
    const payload = await esimAccessPost("/package/list", {
      locationCode: "",
      type: "TOPUP",
      packageCode: "",
      iccid,
    });
    const obj = payload.obj as
      { packageList?: Array<Record<string, unknown>> } | undefined;
    return obj?.packageList ?? [];
  },
  getEsimAccessPackageByCode,
  retailPriceToRub,
  retailPriceToStars,
  retailPriceToUsd,
}));

const {
  listTopupOffers,
  prepareTopupPurchase,
  TOPUP_CHECKOUT_MIN_VALIDITY_MS,
} = await import("~/server/orders/topup");

const DAY_PASS_PKG = {
  packageCode: "PXP1A9DQ8",
  slug: "TR_1_Daily_1Mbps_Premium",
  name: "Turkey 1GB/Day FUP1Mbps Premium",
  retailPrice: 21_700,
  price: 6_200,
  volume: 1024 ** 3,
  duration: 1,
  supportTopUpType: 3,
};

const DAY_PASS_TOPUP = {
  packageCode: "TOPUP_P2HXMQ8P5",
  slug: "TR_1_Daily_Premium",
  name: "Turkey 1GB/Day Premium",
  price: 6_200,
  retailPrice: 21_700,
  duration: 1,
};

const STANDARD_DAY_PASS_TOPUP = {
  ...DAY_PASS_TOPUP,
  packageCode: "TOPUP_PVRR2RMWQ",
  slug: "TR_1_Daily",
  name: "Turkey 1GB/Day",
  price: 5_000,
  retailPrice: 17_500,
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
  test("FUP day-pass presets use the compatible Premium TOPUP slug", async () => {
    const parent = seedParent();
    getEsimAccessPackageByCode.mockResolvedValue({
      meta: { usdRubRate: 90 },
      pkg: DAY_PASS_PKG,
    });
    esimAccessPost.mockResolvedValueOnce({
      success: true,
      obj: {
        packageList: [STANDARD_DAY_PASS_TOPUP, DAY_PASS_TOPUP],
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
      offers.packages.every((pkg) => pkg.packageCode === "TR_1_Daily_Premium"),
    ).toBe(true);
    expect(offers.packages[2]?.priceUsd).toBe(15);
  });

  test("omits a day-pass preset once its supplier provision cost reaches $100", async () => {
    const parent = seedParent();
    getEsimAccessPackageByCode.mockResolvedValue({
      meta: { usdRubRate: 90 },
      pkg: { ...DAY_PASS_PKG, price: 40_000, retailPrice: 5_000_000 },
    });
    esimAccessPost.mockResolvedValue({
      success: true,
      obj: {
        packageList: [
          { ...DAY_PASS_TOPUP, price: 40_000, retailPrice: 5_000_000 },
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
    expect(offers.packages.map((pkg) => pkg.days)).toEqual([1, 3, 7, 15]);
    expect(offers.packages[0]?.priceUsd).toBeGreaterThan(100);
    expect(
      await prepareTopupPurchase({
        userId: "user-1",
        orderUuid: parent.orderUuid,
        packageCode: "TR_1_Daily_Premium",
        days: 1,
      }),
    ).toMatchObject({ supplierCost: 40_000 });
    expect(
      await prepareTopupPurchase({
        userId: "user-1",
        orderUuid: parent.orderUuid,
        packageCode: "TR_1_Daily_Premium",
        days: 30,
      }),
    ).toBe("invalid");
  });

  test("Premium FUP plan does not fall back to a standard daily top-up", async () => {
    const parent = seedParent();
    getEsimAccessPackageByCode.mockResolvedValue({
      meta: { usdRubRate: 90 },
      pkg: DAY_PASS_PKG,
    });
    esimAccessPost.mockResolvedValueOnce({
      success: true,
      obj: { packageList: [STANDARD_DAY_PASS_TOPUP] },
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

  test("keeps a cheap supplier cost when retail is high and drops cost at $100", async () => {
    const parent = seedParent({ resellerPlanId: DATA_PKG.packageCode });
    getEsimAccessPackageByCode.mockResolvedValue({
      meta: { usdRubRate: 90 },
      pkg: DATA_PKG,
    });
    esimAccessPost.mockResolvedValue({
      success: true,
      obj: {
        packageList: [
          {
            packageCode: "TOPUP_CHEAP",
            name: "Europe 1GB 7Days",
            price: 50_000,
            retailPrice: 9_000_000,
            volume: 1024 ** 3,
            duration: 7,
          },
          {
            packageCode: "TOPUP_AT_CAP",
            name: "Europe 50GB 30Days",
            price: 1_000_000,
            retailPrice: 10_000,
            volume: 50 * 1024 ** 3,
            duration: 30,
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
      packages: [{ packageCode: "TOPUP_CHEAP" }],
    });
    if (offers === "not_found" || offers.mode !== "packages") {
      throw new Error("expected packages");
    }
    expect(offers.packages[0]?.priceUsd).toBeGreaterThan(100);
    expect(
      await prepareTopupPurchase({
        userId: "user-1",
        orderUuid: parent.orderUuid,
        packageCode: "TOPUP_AT_CAP",
      }),
    ).toBe("invalid");
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
        packageList: [DAY_PASS_TOPUP],
      },
    });

    const purchase = await prepareTopupPurchase({
      userId: "user-1",
      orderUuid: parent.orderUuid,
      packageCode: "TR_1_Daily_Premium",
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
    expect(purchase.draft.resellerPlanId).toBe("TR_1_Daily_Premium");
    expect(purchase.draft.topupPeriodDays).toBe(7);
    expect(purchase.draft.topupOfOrderId).toBe(parent.id);
    expect(purchase.supplierCost).toBe(41_592);
    expect(purchase.priceUsd).toBe(15);
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
        packageList: [DAY_PASS_TOPUP],
      },
    });

    expect(
      await prepareTopupPurchase({
        userId: "user-1",
        orderUuid: parent.orderUuid,
        packageCode: "TR_1_Daily_Premium",
        days: 5,
      }),
    ).toBe("invalid");
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
        packageList: [DAY_PASS_TOPUP],
      },
    });

    expect(
      await prepareTopupPurchase({
        userId: "user-1",
        orderUuid: parent.orderUuid,
        packageCode: "TR_1_Daily_1Mbps_Premium",
        days: 7,
      }),
    ).toBe("invalid");
  });
});

describe("Premium data top-up preference", () => {
  const standard = {
    packageCode: "TOPUP_STANDARD",
    name: "Turkey 1GB 7Days",
    price: 4600,
    retailPrice: 16100,
    volume: 1024 ** 3,
    duration: 7,
  };
  const premium = {
    ...standard,
    packageCode: "TOPUP_PREMIUM",
    name: "Turkey 1GB 7Days premium",
    price: 5600,
  };

  for (const scenario of [
    { name: "mixed options", listed: [standard, premium], expected: [premium] },
    { name: "standard only", listed: [standard], expected: [standard] },
    { name: "Premium only", listed: [premium], expected: [premium] },
    {
      name: "invalid Premium option",
      listed: [standard, { ...premium, price: 0 }],
      expected: [standard],
    },
    { name: "empty list", listed: [], expected: [] },
  ]) {
    test(`${scenario.name}: listing and checkout use the same preference`, async () => {
      const parent = seedParent({ resellerPlanId: DATA_PKG.packageCode });
      getEsimAccessPackageByCode.mockResolvedValue({
        meta: { usdRubRate: 90 },
        pkg: DATA_PKG,
      });
      esimAccessPost.mockResolvedValue({
        success: true,
        obj: { packageList: scenario.listed },
      });
      const input = { userId: "user-1", orderUuid: parent.orderUuid };
      const offers = await listTopupOffers(input);
      if (scenario.expected.length === 0) {
        expect(offers).toEqual({ mode: "none" });
      } else {
        expect(offers).toMatchObject({
          mode: "packages",
          packages: scenario.expected.map(({ packageCode }) => ({
            packageCode,
          })),
        });
        if (offers === "not_found" || offers.mode !== "packages") {
          throw new Error("expected packages");
        }
        expect(offers.packages).toHaveLength(scenario.expected.length);
      }
      for (const candidate of [standard, premium]) {
        const purchase = await prepareTopupPurchase({
          ...input,
          packageCode: candidate.packageCode,
        });
        if (
          scenario.expected.some(
            (pkg) => pkg.packageCode === candidate.packageCode,
          )
        ) {
          expect(purchase).toMatchObject({
            supplierCost: candidate.price,
            draft: { resellerPlanId: candidate.packageCode },
          });
        } else {
          expect(purchase).toBe("invalid");
        }
      }
    });
  }
});

describe("top-up checkout expiry window", () => {
  for (const remainingMs of [-1, 0, TOPUP_CHECKOUT_MIN_VALIDITY_MS - 1]) {
    test(`does not offer or invoice a top-up with ${remainingMs}ms remaining`, async () => {
      const parent = seedParent({
        expiresAt: new Date(Date.now() + remainingMs),
      });
      expect(
        await listTopupOffers({
          userId: "user-1",
          orderUuid: parent.orderUuid,
        }),
      ).toEqual({ mode: "none" });
      expect(
        await prepareTopupPurchase({
          userId: "user-1",
          orderUuid: parent.orderUuid,
          packageCode: "TR_1_Daily_1Mbps",
          days: 7,
        }),
      ).toBe("unavailable");
      expect(esimAccessPost).not.toHaveBeenCalled();
    });
  }
});
