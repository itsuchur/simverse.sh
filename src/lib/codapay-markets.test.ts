import { expect, test } from "bun:test";
import { alpha2ToNumeric } from "i18n-iso-countries";
import { CODAPAY_COUNTRIES, codapayCountrySchema, detectedCodapayCountry } from "./codapay-markets";

test("enabled portal markets have valid numeric ISO country codes", () => {
  expect(new Set(CODAPAY_COUNTRIES).size).toBe(CODAPAY_COUNTRIES.length);
  for (const country of CODAPAY_COUNTRIES) {
    expect(alpha2ToNumeric(country)).toMatch(/^\d{3}$/);
  }
  expect(alpha2ToNumeric("GB")).toBe("826");
  expect(alpha2ToNumeric("VN")).toBe("704");
  expect(alpha2ToNumeric("PS")).toBe("275");
});

test("Cloudflare country selects an enabled billing market independently of language", () => {
  expect(detectedCodapayCountry(new Headers({ "cf-ipcountry": "TR", "accept-language": "ru" }))).toBe("TR");
  expect(detectedCodapayCountry(new Headers({ "cf-ipcountry": "VN" }))).toBe("VN");
});

test("missing, unsupported and unknown countries never default to another market", () => {
  for (const code of ["", "XX", "T1", "RU", "UZ", "CN", "UA", "TR,VN"]) {
    expect(detectedCodapayCountry(new Headers({ "cf-ipcountry": code }))).toBeNull();
  }
  expect(detectedCodapayCountry(new Headers())).toBeNull();
  expect(codapayCountrySchema.safeParse("UZ").success).toBe(false);
  expect(codapayCountrySchema.safeParse("VN").success).toBe(true);
});
