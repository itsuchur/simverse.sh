import { TELEGRAM_EMAIL_SUFFIX } from "~/server/email/recipient";

export const DASHBOARD_ALLOWED_EMAIL = "support@simverse.sh";

/** Better Auth endpoint that signs in (and on first use, registers) by email code. */
export const EMAIL_OTP_SIGN_IN_PATH = "/sign-in/email-otp";

export function isDashboardEmail(email: string | null | undefined) {
  return email?.toLowerCase() === DASHBOARD_ALLOWED_EMAIL;
}

/**
 * Real buyer addresses may use email codes. Synthetic Telegram addresses
 * cannot receive mail, and the dashboard account signs in with Google only.
 */
export function isEmailCodeAllowed(email: string | null | undefined) {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return (
    normalized.includes("@") &&
    !normalized.endsWith(TELEGRAM_EMAIL_SUFFIX) &&
    !isDashboardEmail(normalized)
  );
}

/**
 * Emails Better Auth may persist: Telegram users, the staff Google account,
 * or a buyer who verified an email code. Google never registers anyone else.
 */
export function isAllowedAuthEmail(
  email: string | null | undefined,
  path?: string,
) {
  if (!email) {
    return false;
  }
  const normalized = email.toLowerCase();
  if (
    normalized.endsWith(TELEGRAM_EMAIL_SUFFIX) ||
    isDashboardEmail(normalized)
  ) {
    return true;
  }
  return path === EMAIL_OTP_SIGN_IN_PATH && isEmailCodeAllowed(normalized);
}
