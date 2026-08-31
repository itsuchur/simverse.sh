import { describe, expect, test } from "bun:test";

import { esimProvisioningUrl, lpaCardData } from "~/lib/esim-provisioning";

describe("lpaCardData", () => {
  test("returns null without an activation code", () => {
    expect(lpaCardData("rsp.example.com", null)).toBeNull();
    expect(lpaCardData("rsp.example.com", "")).toBeNull();
    expect(lpaCardData("rsp.example.com", "   ")).toBeNull();
  });

  test("keeps a full LPA string as-is (case-insensitive prefix)", () => {
    expect(lpaCardData(null, "LPA:1$rsp.example.com$ABC")).toBe(
      "LPA:1$rsp.example.com$ABC",
    );
    expect(lpaCardData(null, "lpa:1$rsp.example.com$ABC")).toBe(
      "lpa:1$rsp.example.com$ABC",
    );
  });

  test("adds the missing LPA prefix to a 1$... code", () => {
    expect(lpaCardData(null, "1$rsp.example.com$ABC")).toBe(
      "LPA:1$rsp.example.com$ABC",
    );
  });

  test("adds the version to a $-prefixed code", () => {
    expect(lpaCardData(null, "$rsp.example.com$ABC")).toBe(
      "LPA:1$rsp.example.com$ABC",
    );
  });

  test("prefixes a bare host$code pair", () => {
    expect(lpaCardData(null, "rsp.example.com$ABC")).toBe(
      "LPA:1$rsp.example.com$ABC",
    );
  });

  test("combines a bare code with the SM-DP address", () => {
    expect(lpaCardData("rsp.example.com", "ABC")).toBe(
      "LPA:1$rsp.example.com$ABC",
    );
    expect(lpaCardData("  rsp.example.com  ", "  ABC  ")).toBe(
      "LPA:1$rsp.example.com$ABC",
    );
  });

  test("returns null for a bare code without an SM-DP address", () => {
    expect(lpaCardData(null, "ABC")).toBeNull();
    expect(lpaCardData("  ", "ABC")).toBeNull();
  });
});

describe("esimProvisioningUrl", () => {
  const cardData = "LPA:1$rsp.example.com$ABC";

  test("builds the Apple provisioning URL with encoded card data", () => {
    expect(esimProvisioningUrl("apple", cardData)).toBe(
      "https://esimsetup.apple.com/esim_qrcode_provisioning?carddata=LPA%3A1%24rsp.example.com%24ABC",
    );
  });

  test("builds the Android provisioning URL", () => {
    expect(esimProvisioningUrl("android", cardData)).toStartWith(
      "https://esimsetup.android.com/esim_qrcode_provisioning?carddata=",
    );
  });
});
