import { describe, expect, test } from "bun:test";

import { esimDeliveryMessage } from "~/server/telegram/esim-delivery";

const CREDENTIALS = {
  smdpAddress: "rsp.example.com",
  activationCode: "MATCH",
  hasQr: false,
};

describe("esimDeliveryMessage", () => {
  test("thanks the buyer and keeps a fixed plan in gigabytes", () => {
    const message = esimDeliveryMessage({
      languageCode: "en",
      packageName: "Spain 1GB 7Days",
      countryCode: "ES",
      dataAmountMb: 1024,
      validityDays: 7,
      ...CREDENTIALS,
    });

    expect(message?.text.startsWith(
      "Your eSIM is ready!\nThank you for buying an eSIM.\n",
    )).toBe(true);
    expect(message?.text).toContain("1 GB · 7 days");
    expect(message?.text).not.toContain("Unlimited");
  });

  test("labels a fair-use plan Unlimited instead of its high-speed allowance", () => {
    const message = esimDeliveryMessage({
      languageCode: "en",
      packageName: "Japan 3GB/Day FUP1Mbps",
      countryCode: "JP",
      dataAmountMb: 3072,
      validityDays: 30,
      ...CREDENTIALS,
    });

    expect(message?.text).toContain("Unlimited · 30 days");
    expect(message?.text).not.toContain("3 GB");
  });

  test("thanks the buyer in Russian and labels a fair-use plan Безлимит", () => {
    const message = esimDeliveryMessage({
      preferredLanguage: "ru",
      packageName: "Japan 3GB/Day FUP1Mbps",
      countryCode: "JP",
      dataAmountMb: 3072,
      validityDays: 7,
      ...CREDENTIALS,
    });

    expect(message?.text.startsWith(
      "Ваша eSIM готова!\nСпасибо за покупку eSIM.\n",
    )).toBe(true);
    expect(message?.text).toContain("Безлимит · 7 дней");
    expect(message?.text).not.toContain("3 GB");
    expect(message?.text).not.toContain("Unlimited");
  });
});
