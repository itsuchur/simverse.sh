import { describe, expect, test } from "bun:test";

import {
  EMAIL_OTP_SIGN_IN_PATH,
  isAllowedAuthEmail,
  isEmailCodeAllowed,
} from "~/server/dashboard/emails";

describe("isEmailCodeAllowed", () => {
  test("a buyer address may receive a sign-in code", () => {
    expect(isEmailCodeAllowed("buyer@example.com")).toBe(true);
  });

  test("the dashboard account and Telegram addresses may not", () => {
    expect(isEmailCodeAllowed("Support@Simverse.sh")).toBe(false);
    expect(isEmailCodeAllowed("42@telegram.local")).toBe(false);
    expect(isEmailCodeAllowed("")).toBe(false);
    expect(isEmailCodeAllowed(undefined)).toBe(false);
  });
});

describe("isAllowedAuthEmail", () => {
  test("Telegram users and the staff account register as before", () => {
    expect(isAllowedAuthEmail("42@telegram.local")).toBe(true);
    expect(isAllowedAuthEmail("support@simverse.sh", "/callback/google")).toBe(
      true,
    );
  });

  test("a buyer address registers only through an email code", () => {
    expect(
      isAllowedAuthEmail("buyer@example.com", EMAIL_OTP_SIGN_IN_PATH),
    ).toBe(true);
    expect(isAllowedAuthEmail("buyer@gmail.com", "/callback/google")).toBe(
      false,
    );
    expect(isAllowedAuthEmail("buyer@example.com")).toBe(false);
  });
});
