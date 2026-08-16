export const DASHBOARD_ALLOWED_EMAIL = "support@simverse.sh";

export function isDashboardEmail(email: string | null | undefined) {
  return email?.toLowerCase() === DASHBOARD_ALLOWED_EMAIL;
}

/** Emails Better Auth may persist: Mini App users or the staff Google account. */
export function isAllowedAuthEmail(email: string | null | undefined) {
  if (!email) {
    return false;
  }
  const normalized = email.toLowerCase();
  return normalized.endsWith("@telegram.local") || isDashboardEmail(normalized);
}
