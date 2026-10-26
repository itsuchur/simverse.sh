import { beforeEach, describe, expect, test } from "bun:test";

import {
  cancelEsimAccessProfile,
  isUnusedEsimAccessProfile,
  orderEsimAccessPackage,
  queryEsimAccessProfiles,
  queryEsimAccessUsage,
  topUpEsimAccessProfile,
} from "~/server/suppliers/esimaccess/order";
import { esimAccessPost, resetTestState } from "~/test/mocks";

beforeEach(resetTestState);

describe("orderEsimAccessPackage", () => {
  test("returns the supplier orderNo and transactionId", async () => {
    esimAccessPost.mockResolvedValueOnce({
      success: true,
      obj: { orderNo: "EA-1", transactionId: "T-1" },
    });

    const result = await orderEsimAccessPackage({
      transactionId: "T-1",
      packageCode: "PKG-1",
      amount: 500,
    });

    expect(result).toEqual({ orderNo: "EA-1", transactionId: "T-1" });
    expect(esimAccessPost.mock.calls[0]?.[0]).toBe("/esim/order");
    expect(esimAccessPost.mock.calls[0]?.[1]).toEqual({
      transactionId: "T-1",
      amount: 500,
      packageInfoList: [{ packageCode: "PKG-1", count: 1, price: 500 }],
    });
  });

  test("throws when the supplier omits the orderNo", async () => {
    esimAccessPost.mockResolvedValueOnce({ success: true, obj: {} });

    expect(
      orderEsimAccessPackage({
        transactionId: "T-1",
        packageCode: "PKG-1",
        amount: 500,
      }),
    ).rejects.toThrow("eSIM Access order did not return orderNo");
  });
});

describe("queryEsimAccessProfiles", () => {
  test("maps profiles and derives the SM-DP address from the activation code", async () => {
    esimAccessPost.mockResolvedValueOnce({
      success: true,
      obj: {
        esimList: [
          {
            iccid: "890",
            esimTranNo: "26041021130002",
            ac: "LPA:1$rsp.example.com$K1",
            qrCodeUrl: "https://qr.example/890",
            esimStatus: "GOT_RESOURCE",
            smdpStatus: "RELEASED",
          },
          { iccid: "891", ac: "1$rsp2.example.com$K2", smdpAddress: "" },
          { ac: "missing-iccid" },
          "junk",
          null,
        ],
      },
    });

    const profiles = await queryEsimAccessProfiles("EA-1");

    expect(profiles).toHaveLength(2);
    expect(profiles[0]).toEqual({
      iccid: "890",
      esimTranNo: "26041021130002",
      ac: "LPA:1$rsp.example.com$K1",
      qrCodeUrl: "https://qr.example/890",
      smdpAddress: "rsp.example.com",
      esimStatus: "GOT_RESOURCE",
      smdpStatus: "RELEASED",
    });
    expect(profiles[1]?.smdpAddress).toBe("rsp2.example.com");
  });

  test("keeps activation time, expiry, and usage from the query profile", async () => {
    esimAccessPost.mockResolvedValueOnce({
      success: true,
      obj: {
        esimList: [
          {
            iccid: "890",
            activateTime: "2026-04-10T21:13:01+0000",
            expiredTime: null,
            totalVolume: 1000,
            orderUsage: 0,
          },
        ],
      },
    });

    const profiles = await queryEsimAccessProfiles("EA-1");

    expect(profiles[0]).toMatchObject({
      iccid: "890",
      activateTime: "2026-04-10T21:13:01+0000",
      expiredTime: null,
      totalVolume: 1000,
      orderUsage: 0,
    });
  });

  test("collects top-up transaction ids from the profile and its packages", async () => {
    esimAccessPost.mockResolvedValueOnce({
      success: true,
      obj: {
        esimList: [
          {
            iccid: "890",
            transactionId: "base-order",
            packageList: [{ packageCode: "TOPUP_CKH491", transactionId: "topup-1" }],
          },
        ],
      },
    });

    const profiles = await queryEsimAccessProfiles("EA-1");
    expect(profiles[0]?.transactionIds).toEqual(["base-order", "topup-1"]);
  });

  test("returns an empty list when the supplier has no profiles yet", async () => {
    esimAccessPost.mockResolvedValueOnce({ success: true, obj: {} });
    expect(await queryEsimAccessProfiles("EA-1")).toEqual([]);
  });
});

describe("isUnusedEsimAccessProfile", () => {
  test("treats GOT_RESOURCE + RELEASED as unused", () => {
    expect(
      isUnusedEsimAccessProfile({
        iccid: "890",
        esimStatus: "GOT_RESOURCE",
        smdpStatus: "RELEASED",
      }),
    ).toBe(true);
  });

  test("rejects activated or installed profiles", () => {
    expect(
      isUnusedEsimAccessProfile({
        iccid: "890",
        esimStatus: "IN_USE",
        smdpStatus: "ENABLED",
      }),
    ).toBe(false);
    expect(
      isUnusedEsimAccessProfile({
        iccid: "890",
        esimStatus: "GOT_RESOURCE",
        smdpStatus: "DOWNLOAD",
      }),
    ).toBe(false);
  });
});

describe("cancelEsimAccessProfile", () => {
  test("posts the esimTranNo to /esim/cancel", async () => {
    esimAccessPost.mockResolvedValueOnce({ success: true, obj: {} });

    await cancelEsimAccessProfile("26041021130002");

    expect(esimAccessPost.mock.calls[0]?.[0]).toBe("/esim/cancel");
    expect(esimAccessPost.mock.calls[0]?.[1]).toEqual({
      esimTranNo: "26041021130002",
    });
  });
});

describe("queryEsimAccessUsage", () => {
  test("posts the esimTranNo and returns consumed and total bytes", async () => {
    esimAccessPost.mockResolvedValueOnce({
      success: true,
      obj: {
        esimUsageList: [
          {
            esimTranNo: "26041021130002",
            dataUsage: 1048576,
            totalData: 1073741824,
            lastUpdateTime: "2026-04-10T21:13:01+0000",
          },
        ],
      },
    });

    const usage = await queryEsimAccessUsage("26041021130002");

    expect(usage).toEqual({ dataUsage: 1048576, totalData: 1073741824 });
    expect(esimAccessPost.mock.calls[0]?.[0]).toBe("/esim/usage/query");
    expect(esimAccessPost.mock.calls[0]?.[1]).toEqual({
      esimTranNoList: ["26041021130002"],
    });
  });

  test("keeps a zero reading", async () => {
    esimAccessPost.mockResolvedValueOnce({
      success: true,
      obj: {
        esimUsageList: [
          { esimTranNo: "26041021130002", dataUsage: 0, totalData: 1000 },
        ],
      },
    });

    expect(await queryEsimAccessUsage("26041021130002")).toEqual({
      dataUsage: 0,
      totalData: 1000,
    });
  });

  test("throws when the matching profile is missing", async () => {
    esimAccessPost.mockResolvedValueOnce({
      success: true,
      obj: {
        esimUsageList: [{ esimTranNo: "other", dataUsage: 1, totalData: 2 }],
      },
    });

    expect(queryEsimAccessUsage("26041021130002")).rejects.toThrow(
      "eSIM Access usage query did not return usage",
    );
  });
});

describe("topUpEsimAccessProfile", () => {
  test("posts a data top-up without a day count", async () => {
    esimAccessPost.mockResolvedValueOnce({
      success: true,
      obj: {
        transactionId: "topup-1",
        iccid: "890",
        expiredTime: "2026-08-24T17:01:37+0000",
        totalVolume: 5000,
        orderUsage: 1000,
      },
    });

    const result = await topUpEsimAccessProfile({
      iccid: "890",
      packageCode: "TOPUP_CKH491",
      transactionId: "topup-1",
      amount: 70000,
    });

    expect(result.iccid).toBe("890");
    expect(esimAccessPost.mock.calls[0]?.[0]).toBe("/esim/topup");
    expect(esimAccessPost.mock.calls[0]?.[1]).toEqual({
      iccid: "890",
      packageCode: "TOPUP_CKH491",
      transactionId: "topup-1",
      amount: 70000,
    });
  });

  test("includes periodNum for a day-pass extension", async () => {
    esimAccessPost.mockResolvedValueOnce({
      success: true,
      obj: { iccid: "890", totalVolume: 1000, orderUsage: 0 },
    });

    await topUpEsimAccessProfile({
      iccid: "890",
      packageCode: "CN_1_Daily",
      transactionId: "topup-2",
      amount: 460000,
      periodNum: 5,
    });

    expect(esimAccessPost.mock.calls[0]?.[1]).toEqual({
      iccid: "890",
      packageCode: "CN_1_Daily",
      transactionId: "topup-2",
      amount: 460000,
      periodNum: 5,
    });
  });

  test("prefers esimTranNo over iccid", async () => {
    esimAccessPost.mockResolvedValueOnce({
      success: true,
      obj: { iccid: "890", totalVolume: 1000, orderUsage: 0 },
    });

    await topUpEsimAccessProfile({
      esimTranNo: "23072017992029",
      iccid: "890",
      packageCode: "CN_1_Daily",
      transactionId: "topup-esimtran",
      amount: 460000,
      periodNum: 7,
    });

    expect(esimAccessPost.mock.calls[0]?.[1]).toEqual({
      esimTranNo: "23072017992029",
      iccid: "",
      packageCode: "CN_1_Daily",
      transactionId: "topup-esimtran",
      amount: 460000,
      periodNum: 7,
    });
  });

  test("throws when the supplier omits the iccid", async () => {
    esimAccessPost.mockResolvedValueOnce({ success: true, obj: {} });

    expect(
      topUpEsimAccessProfile({
        iccid: "890",
        packageCode: "TOPUP_CKH491",
        transactionId: "topup-3",
        amount: 70000,
      }),
    ).rejects.toThrow("eSIM Access topup did not return iccid");
  });
});
