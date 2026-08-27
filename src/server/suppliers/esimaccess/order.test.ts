import { beforeEach, describe, expect, test } from "bun:test";

import {
  orderEsimAccessPackage,
  queryEsimAccessProfiles,
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
    });

    expect(result).toEqual({ orderNo: "EA-1", transactionId: "T-1" });
    expect(esimAccessPost.mock.calls[0]?.[0]).toBe("/esim/order");
    expect(esimAccessPost.mock.calls[0]?.[1]).toEqual({
      transactionId: "T-1",
      packageInfoList: [{ packageCode: "PKG-1", count: 1 }],
    });
  });

  test("throws when the supplier omits the orderNo", async () => {
    esimAccessPost.mockResolvedValueOnce({ success: true, obj: {} });

    expect(
      orderEsimAccessPackage({ transactionId: "T-1", packageCode: "PKG-1" }),
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
      ac: "LPA:1$rsp.example.com$K1",
      qrCodeUrl: "https://qr.example/890",
      smdpAddress: "rsp.example.com",
      esimStatus: "GOT_RESOURCE",
      smdpStatus: "RELEASED",
    });
    expect(profiles[1]?.smdpAddress).toBe("rsp2.example.com");
  });

  test("returns an empty list when the supplier has no profiles yet", async () => {
    esimAccessPost.mockResolvedValueOnce({ success: true, obj: {} });
    expect(await queryEsimAccessProfiles("EA-1")).toEqual([]);
  });
});
