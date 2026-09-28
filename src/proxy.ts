import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";

import { routing } from "./i18n/routing";

const handleI18n = createMiddleware(routing);

/** Routes that live at the locale root, not under `/app`. */
const MINIAPP_PASSTHROUGH = [
  "/help",
  "/tos",
  "/privacy-policy",
  "/refund-policy",
];

function hostnameFromEnv(url: string | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function requestHost(request: NextRequest): string {
  const raw =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    "";
  return raw.split(",")[0]?.trim().split(":")[0]?.toLowerCase() ?? "";
}

function hostAppPrefix(host: string): string | undefined {
  // Marketing site: never pretty-root even if BETTER_AUTH_URL is the apex.
  if (host === "simverse.sh" || host === "www.simverse.sh") {
    return undefined;
  }
  const map: Record<string, string> = {
    "dashboard.simverse.sh": "dashboard",
    "miniapp.simverse.sh": "app",
    "blog.simverse.sh": "blog",
  };
  const miniapp = hostnameFromEnv(process.env.MINIAPP_URL);
  const dashboard = hostnameFromEnv(process.env.BETTER_AUTH_URL);
  const blog = hostnameFromEnv(process.env.BLOG_URL);
  // Pretty-root only when Mini App and dashboard are different hosts.
  // Local ngrok uses one host for both: MINIAPP_URL is unset (or equal to
  // BETTER_AUTH_URL), so /app and /dashboard must stay in the path.
  if (miniapp && dashboard && miniapp !== dashboard) {
    map[miniapp] = "app";
    map[dashboard] = "dashboard";
  }
  if (blog) {
    map[blog] = "blog";
  }
  return map[host];
}

function isMiniappPassthrough(rest: string): boolean {
  return MINIAPP_PASSTHROUGH.some(
    (path) => rest === path || rest.startsWith(`${path}/`),
  );
}

function splitLocalePrefix(
  pathname: string,
  includeDefault = false,
): {
  locale: (typeof routing.locales)[number] | null;
  rest: string;
} {
  for (const locale of routing.locales) {
    if (!includeDefault && locale === routing.defaultLocale) continue;
    if (pathname === `/${locale}`) {
      return { locale, rest: "/" };
    }
    if (pathname.startsWith(`/${locale}/`)) {
      return { locale, rest: pathname.slice(locale.length + 1) };
    }
  }
  return { locale: null, rest: pathname };
}

function joinLocalePath(
  locale: (typeof routing.locales)[number] | null,
  rest: string,
): string {
  if (!locale) return rest;
  if (rest === "/") return `/${locale}`;
  return `/${locale}${rest}`;
}

function hasPathPrefix(rest: string, prefixPath: string): boolean {
  return rest === prefixPath || rest.startsWith(`${prefixPath}/`);
}

/** Internal App Router path: `/{locale}/{prefix}{rest}`. */
function insertInternalPrefix(pathname: string, prefix: string): string {
  const { locale, rest } = splitLocalePrefix(pathname, true);
  const prefixPath = `/${prefix}`;
  if (hasPathPrefix(rest, prefixPath)) {
    return pathname;
  }
  const rewrittenRest = rest === "/" ? prefixPath : `${prefixPath}${rest}`;
  return joinLocalePath(locale, rewrittenRest);
}

/**
 * next-intl must see the public pathname. Mutating `nextUrl` first makes a
 * Russian `/ru` look like the internal `/ru/app`, so next-intl returns
 * `next()` and Next serves the marketing page at the original URL.
 * Locale redirects stay public (`/` → `/ru`). Rewrites gain the host prefix
 * afterwards (`/ru` → `/ru/app`).
 */
function prefixInternalRewrite(
  response: NextResponse,
  request: NextRequest,
  prefix: string,
): NextResponse {
  if (response.headers.has("location")) {
    return response;
  }

  const rewrite = response.headers.get("x-middleware-rewrite");
  const target = new URL(rewrite ?? request.url);
  const prefixedPath = insertInternalPrefix(target.pathname, prefix);
  if (rewrite && prefixedPath === target.pathname) {
    return response;
  }

  target.pathname = prefixedPath;
  const headers = new Headers(response.headers);
  headers.delete("x-middleware-next");
  headers.delete("x-middleware-rewrite");
  return NextResponse.rewrite(target, {
    headers,
    status: response.status,
  });
}

export default function proxy(request: NextRequest) {
  const prefix = hostAppPrefix(requestHost(request));
  if (!prefix) {
    return handleI18n(request);
  }

  const { locale, rest } = splitLocalePrefix(request.nextUrl.pathname);
  const prefixPath = `/${prefix}`;

  if (hasPathPrefix(rest, prefixPath)) {
    const stripped = rest === prefixPath ? "/" : rest.slice(prefixPath.length);
    const url = request.nextUrl.clone();
    url.pathname = joinLocalePath(locale, stripped);
    return NextResponse.redirect(url, 308);
  }

  if (prefix === "app" && isMiniappPassthrough(rest)) {
    return handleI18n(request);
  }

  return prefixInternalRewrite(handleI18n(request), request, prefix);
}

export const config = {
  matcher: "/((?!api|monitoring|ingest|_next|_vercel|.*\\..*).*)",
};
