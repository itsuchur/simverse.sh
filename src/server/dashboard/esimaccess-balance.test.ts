import { describe, expect, test } from "bun:test";

import { formatEsimAccessBalanceUsd } from "./esimaccess-balance";

describe("formatEsimAccessBalanceUsd", () => {
  test("formats USD with two decimals", () => {
    expect(formatEsimAccessBalanceUsd(12.5)).toBe("$12.50");
    expect(formatEsimAccessBalanceUsd(0)).toBe("$0.00");
  });
});
