import { expect, test } from "bun:test";
import { redactUnitpayTelemetry } from "./unitpay-telemetry";

test("Unitpay API credentials are removed from automatic HTTP spans and breadcrumbs", () => {
  const original = {
    description:
      "GET https://unitpay.money/api?method=initPayment&secretKey=private%20value&sum=10",
    data: {
      url: "https://unitpay.money/api?secretKey=private",
      values: ["https://unitpay.money/api?secretKey=private#fragment", null, 1],
    },
  };
  const result = redactUnitpayTelemetry(original);
  expect(JSON.stringify(result)).not.toContain("private");
  expect(result.description).toContain("secretKey=[REDACTED]&sum=10");
  expect(result.data.values).toEqual([
    "https://unitpay.money/api?secretKey=[REDACTED]#fragment",
    null,
    1,
  ]);
  expect(original.data.url).toContain("private");
});
