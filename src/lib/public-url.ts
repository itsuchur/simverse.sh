import { publicPathForLocale, type AppLocale } from "~/i18n/preferred-locale";
import { routing } from "~/i18n/routing";

export const MARKETING_ORIGIN = "https://simverse.sh";
export const BLOG_ORIGIN = "https://blog.simverse.sh";

const LOCALES = routing.locales;

export function requestHostname(value: string | null | undefined): string {
  return value?.split(",")[0]?.trim().split(":")[0]?.toLowerCase() ?? "";
}

function hostnameFromEnv(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

export function isBlogHostname(host: string): boolean {
  return (
    host === "blog.simverse.sh" ||
    host === hostnameFromEnv(process.env.BLOG_URL)
  );
}

export function isMarketingHostname(host: string): boolean {
  return host === "simverse.sh" || host === "www.simverse.sh";
}

/** Public origin for hosts that should be indexed. Other hosts have none. */
export function originForHost(host: string): string | null {
  if (isBlogHostname(host)) return BLOG_ORIGIN;
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
 * Internal `/blog/...` path (any locale prefix) as the public blog path.
 * `/blog/how-to` → `/how-to`, `/ru/blog` → `/ru`. Null when it is not a blog route.
 */
export function prettyBlogPath(pathname: string): string | null {
  const { locale, rest } = splitLocale(pathname);
  if (rest !== "/blog" && !rest.startsWith("/blog/")) return null;
  const stripped = stripTrailingSlash(
    rest === "/blog" ? "/" : rest.slice("/blog".length),
  );
  return withLocale(locale, stripped);
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

  if (nextHost === "simverse.sh" || isBlogHostname(nextHost)) {
    const pretty = prettyBlogPath(nextPath);
    if (pretty) {
      nextHost = "blog.simverse.sh";
      nextPath = pretty;
    }
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

/** Blog-host paths other than the locale index are articles. */
export function isBlogArticlePath(
  host: string,
  publicPathname: string,
): boolean {
  if (!isBlogHostname(host)) return false;
  const { rest } = splitLocale(publicPathname);
  return rest !== "/";
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
      publicPathForLocale(`/${slug}`, locale),
    );
  }
  if (languages.en) languages["x-default"] = languages.en;
  return {
    canonical: languages[currentLocale],
    languages,
  };
}

export function blogListPath(onBlogHost: boolean): "/" | "/blog" {
  return onBlogHost ? "/" : "/blog";
}

export function blogPostPath(onBlogHost: boolean, slug: string): string {
  return onBlogHost ? `/${slug}` : `/blog/${slug}`;
}
