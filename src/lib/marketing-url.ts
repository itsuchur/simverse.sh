import { getPathname } from "~/i18n/navigation";
import type { routing } from "~/i18n/routing";
import { MARKETING_ORIGIN } from "~/lib/public-url";

export type LegalPath = "/tos" | "/privacy-policy" | "/refund-policy";

/** Absolute marketing-site URL for a locale path such as `/tos` or `/ru/tos`. */
export function marketingUrl(pathname: string) {
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${MARKETING_ORIGIN}${path}`;
}

export function marketingLegalUrl(
  href: LegalPath,
  locale: (typeof routing.locales)[number],
) {
  return marketingUrl(getPathname({ href, locale }));
}
