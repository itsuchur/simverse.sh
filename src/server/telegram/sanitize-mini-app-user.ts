import { z } from "zod";
import type { TelegramMiniAppUser } from "better-auth-telegram";

/** Telegram first_name (64) + space + last_name (64). */
export const MAX_DISPLAY_NAME_LENGTH = 129;
export const MAX_PHOTO_URL_LENGTH = 2048;

const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;

function stripControlChars(value: string): string {
  return value.replace(CONTROL_CHARS, "");
}

function stripped(value: string): string {
  return stripControlChars(value).trim();
}

export const telegramIdSchema = z
  .union([z.number().int().positive(), z.string()])
  .transform((value) =>
    typeof value === "number" ? String(value) : stripped(value),
  )
  .pipe(z.string().regex(/^[1-9]\d{0,19}$/));

export const telegramUsernameSchema = z
  .string()
  .transform(stripped)
  .pipe(z.string().regex(/^[A-Za-z0-9_]{5,32}$/));

export const languageCodeSchema = z
  .string()
  .transform(stripped)
  .pipe(
    z
      .string()
      .max(35)
      .regex(/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/),
  );

export const httpsUrlSchema = z
  .string()
  .transform(stripped)
  .pipe(z.string().min(1).max(MAX_PHOTO_URL_LENGTH))
  .refine((value) => {
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return false;
    }
  });

export const displayNameSchema = z
  .string()
  .transform((value) => stripped(value).slice(0, MAX_DISPLAY_NAME_LENGTH));

export function sanitizeTelegramId(value: unknown): string | null {
  const parsed = telegramIdSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function sanitizeTelegramUsername(value: unknown): string | undefined {
  if (value == null || value === "") {
    return undefined;
  }
  const parsed = telegramUsernameSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function sanitizeLanguageCode(value: unknown): string | undefined {
  if (value == null || value === "") {
    return undefined;
  }
  const parsed = languageCodeSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function sanitizeHttpsUrl(value: unknown): string | undefined {
  if (value == null || value === "") {
    return undefined;
  }
  const parsed = httpsUrlSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

export function sanitizeDisplayName(value: unknown): string {
  const parsed = displayNameSchema.safeParse(
    typeof value === "string" ? value : "",
  );
  const name = parsed.success ? parsed.data : "";
  return name.length > 0 ? name : "User";
}

export function sanitizeMiniAppMappedUser(user: TelegramMiniAppUser) {
  const telegramId = sanitizeTelegramId(user.id);
  if (!telegramId) {
    throw new InvalidTelegramIdError();
  }

  const rawName = user.last_name
    ? `${user.first_name} ${user.last_name}`
    : user.first_name;

  return {
    name: sanitizeDisplayName(rawName),
    image: sanitizeHttpsUrl(user.photo_url),
    email: `${telegramId}@telegram.local`,
    languageCode: sanitizeLanguageCode(user.language_code),
    isPremium: user.is_premium === true,
    allowsWriteToPm: user.allows_write_to_pm === true,
  };
}

export class InvalidTelegramIdError extends Error {
  constructor() {
    super("Invalid Telegram user id");
    this.name = "InvalidTelegramIdError";
  }
}

export type PersistableTelegramFields = {
  name: string;
  image?: string | null;
  telegramId?: string | null;
  telegramUsername?: string | null;
  languageCode?: string | null;
};

/** Re-clamp plugin-overwritten fields immediately before Prisma persist. */
export function sanitizeUserForPersist<T extends PersistableTelegramFields>(
  user: T,
): T {
  const telegramId =
    user.telegramId == null || user.telegramId === ""
      ? user.telegramId
      : sanitizeTelegramId(user.telegramId);

  if (user.telegramId != null && user.telegramId !== "" && !telegramId) {
    throw new InvalidTelegramIdError();
  }

  const telegramUsername =
    user.telegramUsername == null || user.telegramUsername === ""
      ? user.telegramUsername
      : (sanitizeTelegramUsername(user.telegramUsername) ?? null);

  const languageCode =
    user.languageCode == null || user.languageCode === ""
      ? user.languageCode
      : (sanitizeLanguageCode(user.languageCode) ?? null);

  const image =
    user.image == null || user.image === ""
      ? user.image
      : (sanitizeHttpsUrl(user.image) ?? null);

  return {
    ...user,
    name: sanitizeDisplayName(user.name),
    image,
    telegramId,
    telegramUsername,
    languageCode,
  };
}

export type PersistableTelegramAccountFields = {
  telegramId?: string | null;
  telegramUsername?: string | null;
};

export function sanitizeAccountForPersist<T extends object>(account: T): T {
  const row = account as T & PersistableTelegramAccountFields;

  if (
    (row.telegramId == null || row.telegramId === "") &&
    (row.telegramUsername == null || row.telegramUsername === "")
  ) {
    return account;
  }

  const telegramId =
    row.telegramId == null || row.telegramId === ""
      ? row.telegramId
      : sanitizeTelegramId(row.telegramId);

  if (row.telegramId != null && row.telegramId !== "" && !telegramId) {
    throw new InvalidTelegramIdError();
  }

  const telegramUsername =
    row.telegramUsername == null || row.telegramUsername === ""
      ? row.telegramUsername
      : (sanitizeTelegramUsername(row.telegramUsername) ?? null);

  return {
    ...account,
    telegramId,
    telegramUsername,
  };
}
