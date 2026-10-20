import { routing } from "./routing";

export const PUBLIC_PATHNAME_HEADER = "x-public-pathname";
export const PUBLIC_SEARCH_HEADER = "x-public-search";

export type AppLocale = (typeof routing.locales)[number];

export function isAppLocale(
  value: string | null | undefined,
): value is AppLocale {
  return value === "en" || value === "ru";
}

/** Public pathname with any locale prefix removed (`/ru/profile` → `/profile`). */
export function stripLocalePrefix(pathname: string): string {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}`) return "/";
    if (pathname.startsWith(`/${locale}/`)) {
      return pathname.slice(locale.length + 1);
    }
  }
  return pathname;
}

/** Public path for a locale. The default locale stays unprefixed. */
export function publicPathForLocale(
  pathname: string,
  locale: AppLocale,
): string {
  const rest = stripLocalePrefix(pathname);
  if (locale === routing.defaultLocale) return rest;
  if (rest === "/") return `/${locale}`;
  return `/${locale}${rest}`;
}

function isSafePathname(pathname: string): boolean {
  return (
    pathname.startsWith("/") &&
    !pathname.startsWith("//") &&
    !pathname.includes("\\") &&
    !pathname.includes("\0")
  );
}

function isSafeSearch(search: string): boolean {
  return search === "" || (search.startsWith("?") && !/[\r\n]/.test(search));
}

/**
 * Where to send the browser when the saved language disagrees with the
 * current page. Null when no redirect is needed, or the path isn't one we
 * produced.
 */
export function preferredLocaleRedirectTarget(
  currentLocale: string,
  preferred: string | null | undefined,
  pathname: string,
  search: string,
): string | null {
  if (!isAppLocale(preferred) || preferred === currentLocale) return null;
  if (!isSafePathname(pathname)) return null;
  const query = isSafeSearch(search) ? search : "";
  const target = `${publicPathForLocale(pathname, preferred)}${query}`;
  if (target === `${pathname}${query}`) return null;
  return target;
}
