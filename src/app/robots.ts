import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

import { requestSite } from "~/lib/request-site";
import { isMarketingHostname } from "~/lib/public-url";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const site = await requestSite();
  if (isMarketingHostname(site.host) && site.origin) {
    return {
      rules: { userAgent: "*", allow: "/" },
      sitemap: `${site.origin}/sitemap.xml`,
    };
  }

  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
