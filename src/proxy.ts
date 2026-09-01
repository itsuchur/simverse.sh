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

function splitLocalePrefix(pathname: string): {
  locale: (typeof routing.locales)[number] | null;
  rest: string;
} {
  for (const locale of routing.locales) {
    if (locale === routing.defaultLocale) continue;
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

export default function proxy(request: NextRequest) {
  const prefix = hostAppPrefix(requestHost(request));
  if (!prefix) {
    return handleI18n(request);
  }

  const { locale, rest } = splitLocalePrefix(request.nextUrl.pathname);
  const prefixPath = `/${prefix}`;
  const hasPrefix = rest === prefixPath || rest.startsWith(`${prefixPath}/`);

  if (hasPrefix) {
    const stripped = rest === prefixPath ? "/" : rest.slice(prefixPath.length);
    const url = request.nextUrl.clone();
    url.pathname = joinLocalePath(locale, stripped);
    return NextResponse.redirect(url, 308);
  }

  if (prefix === "app" && isMiniappPassthrough(rest)) {
    return handleI18n(request);
  }

  const rewrittenRest = rest === "/" ? prefixPath : `${prefixPath}${rest}`;
  request.nextUrl.pathname = joinLocalePath(locale, rewrittenRest);
  return handleI18n(request);
}

export const config = {
  matcher: "/((?!api|monitoring|ingest|_next|_vercel|.*\\..*).*)",
};
