import { publicPathForLocale, type AppLocale } from "~/i18n/preferred-locale";
import { routing } from "~/i18n/routing";

export const MARKETING_ORIGIN = "https://simverse.sh";

const LOCALES = routing.locales;

export function requestHostname(value: string | null | undefined): string {
  return value?.split(",")[0]?.trim().split(":")[0]?.toLowerCase() ?? "";
}

export function isMarketingHostname(host: string): boolean {
  return host === "simverse.sh" || host === "www.simverse.sh";
}

/** Public origin for hosts that should be indexed. Other hosts have none. */
export function originForHost(host: string): string | null {
  if (isMarketingHostname(host)) return MARKETING_ORIGIN;
  return null;
}

export function absoluteUrl(origin: string, pathname: string): string {
  if (pathname === "/" || pathname === "") return origin;
  return `${origin}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

export function stripTrailingSlash(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.replace(/\/+$/, "") || "/";
  }
  return pathname;
}

function splitLocale(pathname: string): {
  locale: AppLocale | null;
  rest: string;
} {
  for (const locale of LOCALES) {
    if (pathname === `/${locale}`) return { locale, rest: "/" };
    if (pathname.startsWith(`/${locale}/`)) {
      return { locale, rest: pathname.slice(locale.length + 1) };
    }
  }
  return { locale: null, rest: pathname };
}

function withLocale(locale: AppLocale | null, rest: string): string {
  const path = rest.startsWith("/") ? rest : `/${rest}`;
  if (!locale || locale === routing.defaultLocale) return path;
  if (path === "/") return `/${locale}`;
  return `/${locale}${path}`;
}

/**
 * One hop to the canonical host and path. Null when the request is already
 * canonical. Does not touch the Mini App, dashboard, or other hosts except
 * to drop a trailing slash.
 */
export function canonicalRequestTarget(
  host: string,
  pathname: string,
): { host: string; pathname: string } | null {
  let nextHost = host;
  let nextPath = pathname;

  if (host === "www.simverse.sh") nextHost = "simverse.sh";

  if (host === "blog.simverse.sh") {
    nextHost = "simverse.sh";
    const { locale, rest } = splitLocale(stripTrailingSlash(pathname));
    const blogPath =
      rest === "/blog" || rest.startsWith("/blog/")
        ? rest
        : rest === "/"
          ? "/blog"
          : `/blog${rest}`;
    nextPath = withLocale(locale, blogPath);
  }

  nextPath = stripTrailingSlash(nextPath);
  if (nextHost === host && nextPath === pathname) return null;
  return { host: nextHost, pathname: nextPath };
}

export function pageAlternates(origin: string, publicPathname: string) {
  const en = absoluteUrl(origin, publicPathForLocale(publicPathname, "en"));
  const ru = absoluteUrl(origin, publicPathForLocale(publicPathname, "ru"));
  return {
    canonical: absoluteUrl(origin, publicPathname || "/"),
    languages: { en, ru, "x-default": en },
  };
}

/** Public blog article paths, excluding the list page. */
export function isBlogArticlePath(
  host: string,
  publicPathname: string,
): boolean {
  if (!isMarketingHostname(host)) return false;
  const { rest } = splitLocale(publicPathname);
  return rest.startsWith("/blog/");
}

export function articleAlternates(
  origin: string,
  currentLocale: AppLocale,
  slugs: Partial<Record<AppLocale, string>>,
) {
  const languages: Record<string, string> = {};
  for (const locale of LOCALES) {
    const slug = slugs[locale];
    if (!slug) continue;
    languages[locale] = absoluteUrl(
      origin,
      publicPathForLocale(`/blog/${slug}`, locale),
    );
  }
  if (languages.en) languages["x-default"] = languages.en;
  return {
    canonical: languages[currentLocale],
    languages,
  };
}
