import "server-only";

import { headers } from "next/headers";

import { PUBLIC_PATHNAME_HEADER } from "~/i18n/preferred-locale";

import { isBlogHostname, originForHost, requestHostname } from "./public-url";

export async function requestSite() {
  const headerList = await headers();
  const host = requestHostname(
    headerList.get("x-forwarded-host") ?? headerList.get("host"),
  );
  return {
    host,
    origin: originForHost(host),
    pathname: headerList.get(PUBLIC_PATHNAME_HEADER) ?? "/",
    onBlogHost: isBlogHostname(host),
  };
}
