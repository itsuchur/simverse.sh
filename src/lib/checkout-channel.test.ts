import { describe, expect, test } from "bun:test";

import {
  readReturnChannel,
  webPaymentResultPath,
  withReturnChannel,
} from "./checkout-channel";

describe("checkout return channel", () => {
  test("leaves Mini App return URLs unchanged", () => {
    expect(
      withReturnChannel(
        "/checkout/platega/return?status=success",
        "miniapp",
        "ru",
      ),
    ).toBe("/checkout/platega/return?status=success");
    expect(withReturnChannel("/checkout/paypal/return", undefined, "en")).toBe(
      "/checkout/paypal/return",
    );
  });

  test("tags web return URLs with channel and locale", () => {
    expect(withReturnChannel("/checkout/paypal/return", "web", "en")).toBe(
      "/checkout/paypal/return?channel=web&locale=en",
    );
    expect(
      withReturnChannel("/checkout/platega/return?status=fail", "web", "ru"),
    ).toBe("/checkout/platega/return?status=fail&channel=web&locale=ru");
  });

  test("falls back to the Mini App and default locale for unknown values", () => {
    expect(
      readReturnChannel(new URLSearchParams("channel=evil&locale=xx")),
    ).toEqual({
      channel: "miniapp",
      locale: "en",
    });
    expect(
      readReturnChannel(new URLSearchParams("channel=web&locale=ru")),
    ).toEqual({
      channel: "web",
      locale: "ru",
    });
  });

  test("sends web buyers to their account or back to checkout", () => {
    expect(webPaymentResultPath("success", "en")).toBe(
      "/account?payment=success",
    );
    expect(webPaymentResultPath("success", "ru")).toBe(
      "/ru/account?payment=success",
    );
    expect(webPaymentResultPath("fail", "ru")).toBe(
      "/ru/checkout?payment=failed",
    );
  });
});
