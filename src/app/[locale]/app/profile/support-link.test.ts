import { expect, test } from "bun:test";

import { supportTelegramHref } from "./support-link";

const SUPPORT_URL = "https://t.me/simversesupport";

test("prefills the support chat with the Telegram ID", () => {
  expect(supportTelegramHref("123456789")).toBe(
    `${SUPPORT_URL}?text=${encodeURIComponent("Telegram ID: 123456789")}`,
  );
});

test("opens the bare support chat when the Telegram ID is missing", () => {
  expect(supportTelegramHref(null)).toBe(SUPPORT_URL);
  expect(supportTelegramHref(undefined)).toBe(SUPPORT_URL);
  expect(supportTelegramHref("")).toBe(SUPPORT_URL);
});
