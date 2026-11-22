import { describe, expect, test } from "bun:test";

import { buyerChannel } from "~/server/email/recipient";

const BASE = {
  telegramId: null,
  email: "buyer@example.com",
  emailVerified: true,
  isBanned: false,
  isDeleted: false,
};

describe("buyerChannel", () => {
  test("a Telegram user keeps receiving notices in Telegram", () => {
    expect(
      buyerChannel({ ...BASE, telegramId: "42", email: "42@telegram.local" }),
    ).toEqual({ kind: "telegram", chatId: 42 });
  });

  test("a user without Telegram gets email at their verified address", () => {
    expect(buyerChannel({ ...BASE, email: " Buyer@Example.com " })).toEqual({
      kind: "email",
      to: "buyer@example.com",
    });
  });

  test("an unverified or synthetic address gets nothing", () => {
    expect(buyerChannel({ ...BASE, emailVerified: false })).toBeNull();
    expect(buyerChannel({ ...BASE, email: "42@telegram.local" })).toBeNull();
  });

  test("banned and deleted users get nothing on either channel", () => {
    expect(buyerChannel({ ...BASE, isBanned: true })).toBeNull();
    expect(
      buyerChannel({ ...BASE, telegramId: "42", isDeleted: true }),
    ).toBeNull();
  });

  test("an invalid Telegram id never falls back to email", () => {
    expect(buyerChannel({ ...BASE, telegramId: "not-a-number" })).toBeNull();
  });
});
