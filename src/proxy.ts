import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";

import { routing } from "./i18n/routing";

const handleI18n = createMiddleware(routing);

const HOST_APP_PREFIX: Record<string, string> = {
  "dashboard.simverse.sh": "dashboard",
  "miniapp.simverse.sh": "app",
};

function requestHost(request: NextRequest): string {
  const raw =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "";
  return raw.split(",")[0]?.trim().split(":")[0]?.toLowerCase() ?? "";
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
  const prefix = HOST_APP_PREFIX[requestHost(request)];
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

  const rewrittenRest = rest === "/" ? prefixPath : `${prefixPath}${rest}`;
  request.nextUrl.pathname = joinLocalePath(locale, rewrittenRest);
  return handleI18n(request);
}

export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/monitoring`, `/ingest`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: "/((?!api|monitoring|ingest|_next|_vercel|.*\\..*).*)",
};
