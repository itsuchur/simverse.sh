import { expect, test } from "bun:test";

import { marketingLegalUrl } from "./marketing-url";

test("legal documents resolve on the marketing host for every locale", () => {
  expect(marketingLegalUrl("/tos", "ru")).toBe("https://simverse.sh/ru/tos");
  expect(marketingLegalUrl("/privacy-policy", "ru")).toBe(
    "https://simverse.sh/ru/privacy-policy",
  );
  expect(marketingLegalUrl("/refund-policy", "ru")).toBe(
    "https://simverse.sh/ru/refund-policy",
  );

  expect(marketingLegalUrl("/tos", "en")).toBe("https://simverse.sh/tos");
  expect(marketingLegalUrl("/privacy-policy", "en")).toBe(
    "https://simverse.sh/privacy-policy",
  );
  expect(marketingLegalUrl("/refund-policy", "en")).toBe(
    "https://simverse.sh/refund-policy",
  );
});
