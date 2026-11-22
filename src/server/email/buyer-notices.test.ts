import { beforeEach, describe, expect, test } from "bun:test";
import { render } from "@react-email/components";

import { fakeDb } from "~/test/fake-db";
import {
  resetTestState,
  sendEmail,
  telegramSendMessage,
  telegramSendPhoto,
} from "~/test/mocks";
import { notifyBuyerEsimDelivery } from "~/server/telegram/esim-delivery";
import { notifyBuyerRefundNotice } from "~/server/telegram/refund-notice";

function seedDeliveredOrder(userId: string) {
  return fakeDb.seedOrder({
    userId,
    packageName: "Spain 1GB 7Days",
    countryCode: "ES",
    dataAmountMb: 1024,
    validityDays: 7,
    esimQrUrl: "https://p.qrsim.net/qr.png",
    esimSmdpAddress: "rsp.example.com",
    esimActivationCode: "LPA:1$rsp.example.com$MATCH-1",
  });
}

describe("buyer notices without Telegram", () => {
  beforeEach(() => {
    resetTestState();
  });

  test("an email buyer receives the eSIM by email in their language", async () => {
    fakeDb.seedUser({
      id: "email-user",
      email: "buyer@example.com",
      emailVerified: true,
      preferredLanguage: "ru",
    });
    const order = seedDeliveredOrder("email-user");

    await notifyBuyerEsimDelivery(order.id);

    expect(telegramSendPhoto).not.toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const email = sendEmail.mock.calls[0]?.[0];
    expect(email?.to).toBe("buyer@example.com");
    expect(email?.kind).toBe("esim_delivery");
    expect(email?.subject).toBe("Ваша eSIM готова! Испания");

    const html = await render(email?.react as Parameters<typeof render>[0]);
    expect(html).toContain("rsp.example.com");
    expect(html).toContain("MATCH-1");
    expect(html).toContain("https://p.qrsim.net/qr.png");
    expect(html).toContain("esimsetup.apple.com");
    expect(html).toContain("/ru/account");
  });

  test("a Telegram buyer still gets the Telegram message and no email", async () => {
    fakeDb.seedUser({ id: "tg-user", telegramId: "42" });
    const order = seedDeliveredOrder("tg-user");

    await notifyBuyerEsimDelivery(order.id);

    expect(telegramSendPhoto).toHaveBeenCalledTimes(1);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test("a refund notice reaches an email buyer", async () => {
    fakeDb.seedUser({
      id: "email-user",
      email: "buyer@example.com",
      emailVerified: true,
    });
    const order = seedDeliveredOrder("email-user");

    await notifyBuyerRefundNotice(order.id);

    expect(telegramSendMessage).not.toHaveBeenCalled();
    expect(sendEmail.mock.calls[0]?.[0]).toMatchObject({
      to: "buyer@example.com",
      kind: "refund_notice",
      subject: "Your Simverse payment was refunded",
    });
  });
});
