import { describe, expect, test } from "bun:test";
import type { TelegramMiniAppUser } from "better-auth-telegram";

import {
  InvalidTelegramIdError,
  MAX_DISPLAY_NAME_LENGTH,
  sanitizeAccountForPersist,
  sanitizeDisplayName,
  sanitizeHttpsUrl,
  sanitizeLanguageCode,
  sanitizeMiniAppMappedUser,
  sanitizeTelegramId,
  sanitizeTelegramUsername,
  sanitizeUserForPersist,
  type PersistableTelegramFields,
} from "./sanitize-mini-app-user";

const miniAppUser = (
  overrides: Partial<TelegramMiniAppUser> = {},
): TelegramMiniAppUser => ({
  id: 123456789,
  first_name: "Ada",
  ...overrides,
});

describe("sanitizeTelegramId", () => {
  test("accepts a positive integer and digit string", () => {
    expect(sanitizeTelegramId(42)).toBe("42");
    expect(sanitizeTelegramId("987654321")).toBe("987654321");
  });

  test("rejects zero, negatives, and non-numeric values", () => {
    expect(sanitizeTelegramId(0)).toBeNull();
    expect(sanitizeTelegramId(-1)).toBeNull();
    expect(sanitizeTelegramId("0")).toBeNull();
    expect(sanitizeTelegramId("12abc")).toBeNull();
    expect(sanitizeTelegramId("1; DROP TABLE user")).toBeNull();
  });
});

describe("sanitizeDisplayName", () => {
  test("strips control characters", () => {
    expect(sanitizeDisplayName("Ada\u0000\nLovelace")).toBe("AdaLovelace");
  });

  test("clamps names longer than Telegram first+last", () => {
    const oversized = "A".repeat(MAX_DISPLAY_NAME_LENGTH + 40);
    expect(sanitizeDisplayName(oversized)).toBe(
      "A".repeat(MAX_DISPLAY_NAME_LENGTH),
    );
  });

  test("falls back when the value is empty after stripping", () => {
    expect(sanitizeDisplayName("\u0000\n")).toBe("User");
  });
});

describe("sanitizeTelegramUsername", () => {
  test("accepts a Telegram username", () => {
    expect(sanitizeTelegramUsername("ada_lovelace")).toBe("ada_lovelace");
  });

  test("drops invalid usernames", () => {
    expect(sanitizeTelegramUsername("ab")).toBeUndefined();
    expect(sanitizeTelegramUsername("ada lovelace")).toBeUndefined();
    expect(sanitizeTelegramUsername("ada;drop")).toBeUndefined();
  });
});

describe("sanitizeLanguageCode", () => {
  test("accepts short BCP-47 tags", () => {
    expect(sanitizeLanguageCode("en")).toBe("en");
    expect(sanitizeLanguageCode("pt-BR")).toBe("pt-BR");
  });

  test("drops invalid tags", () => {
    expect(sanitizeLanguageCode("EN")).toBeUndefined();
    expect(sanitizeLanguageCode("en;select")).toBeUndefined();
  });
});

describe("sanitizeHttpsUrl", () => {
  test("accepts https photo URLs", () => {
    expect(sanitizeHttpsUrl("https://cdn.telegram.org/file.jpg")).toBe(
      "https://cdn.telegram.org/file.jpg",
    );
  });

  test("drops non-https URLs", () => {
    expect(
      sanitizeHttpsUrl("http://cdn.telegram.org/file.jpg"),
    ).toBeUndefined();
    expect(sanitizeHttpsUrl("javascript:alert(1)")).toBeUndefined();
  });
});

describe("sanitizeMiniAppMappedUser", () => {
  test("maps a valid Mini App user to persistable fields", () => {
    expect(
      sanitizeMiniAppMappedUser(
        miniAppUser({
          last_name: "Lovelace",
          username: "ada_lovelace",
          photo_url: "https://cdn.telegram.org/ada.jpg",
          language_code: "en",
          is_premium: true,
          allows_write_to_pm: true,
        }),
      ),
    ).toEqual({
      name: "Ada Lovelace",
      image: "https://cdn.telegram.org/ada.jpg",
      email: "123456789@telegram.local",
      languageCode: "en",
      isPremium: true,
      allowsWriteToPm: true,
    });
  });

  test("throws on an invalid telegram id", () => {
    expect(() => sanitizeMiniAppMappedUser(miniAppUser({ id: 0 }))).toThrow(
      InvalidTelegramIdError,
    );
  });
});

describe("sanitizeUserForPersist", () => {
  test("re-clamps plugin-overwritten username and name", () => {
    const input: PersistableTelegramFields = {
      name: `Ada\u0000 ${"B".repeat(200)}`,
      telegramId: "123456789",
      telegramUsername: "not valid!!",
      languageCode: "nope!",
      image: "http://evil.example/x",
    };
    const persisted = sanitizeUserForPersist(input);
    const expected: PersistableTelegramFields = {
      name: `Ada ${"B".repeat(MAX_DISPLAY_NAME_LENGTH - 4)}`,
      telegramId: "123456789",
      telegramUsername: null,
      languageCode: null,
      image: null,
    };
    expect(persisted).toEqual(expected);
  });

  test("throws when a present telegramId is invalid", () => {
    expect(() =>
      sanitizeUserForPersist({
        name: "Ada",
        telegramId: "12; drop",
      }),
    ).toThrow(InvalidTelegramIdError);
  });

  test("leaves Google users without telegram fields unchanged except name", () => {
    expect(
      sanitizeUserForPersist({
        name: "Staff",
        telegramId: null,
        telegramUsername: null,
      }),
    ).toEqual({
      name: "Staff",
      telegramId: null,
      telegramUsername: null,
    });
  });
});

describe("sanitizeAccountForPersist", () => {
  test("drops an invalid username and keeps a valid id", () => {
    const persisted = sanitizeAccountForPersist({
      telegramId: "123456789",
      telegramUsername: "x'; drop",
    });
    expect(persisted.telegramId).toBe("123456789");
    expect(persisted.telegramUsername).toBeNull();
  });
});
