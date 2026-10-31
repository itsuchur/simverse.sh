import type { MetadataRoute } from "next";

export const dynamic = "force-dynamic";

import {
  isAppLocale,
  publicPathForLocale,
  type AppLocale,
} from "~/i18n/preferred-locale";
import { routing } from "~/i18n/routing";
import { requestSite } from "~/lib/request-site";
import {
  absoluteUrl,
  isMarketingHostname,
  MARKETING_ORIGIN,
} from "~/lib/public-url";
import {
  articleLocalizations,
  fetchPublishedArticles,
  type StrapiArticle,
} from "~/server/strapi";

const MARKETING_PATHS = [
  "/",
  "/help",
  "/tos",
  "/privacy-policy",
  "/refund-policy",
] as const;

function localized(origin: string, pathname: string): MetadataRoute.Sitemap {
  const languages = {
    en: absoluteUrl(origin, publicPathForLocale(pathname, "en")),
    ru: absoluteUrl(origin, publicPathForLocale(pathname, "ru")),
    "x-default": absoluteUrl(origin, publicPathForLocale(pathname, "en")),
  };
  return routing.locales.map((locale) => ({
    url: languages[locale],
    alternates: { languages },
  }));
}

function articleEntries(articles: StrapiArticle[]): MetadataRoute.Sitemap {
  const groups = new Map<
    string,
    Partial<Record<AppLocale, { slug: string; modified: string | null }>>
  >();

  for (const article of articles) {
    if (!article.slug) continue;
    const key = article.documentId || `${article.locale ?? ""}:${article.slug}`;
    const group = groups.get(key) ?? {};
    const modified = article.updatedAt ?? article.publishedAt;
    if (isAppLocale(article.locale)) {
      group[article.locale] = { slug: article.slug, modified };
    }
    for (const localization of articleLocalizations(article)) {
      if (!isAppLocale(localization.locale) || !localization.slug) continue;
      group[localization.locale] ??= {
        slug: localization.slug,
        modified: null,
      };
    }
    groups.set(key, group);
  }

  const entries: MetadataRoute.Sitemap = [];
  for (const group of groups.values()) {
    const languages: Record<string, string> = {};
    for (const locale of routing.locales) {
      const item = group[locale];
      if (!item) continue;
      languages[locale] = absoluteUrl(
        MARKETING_ORIGIN,
        publicPathForLocale(`/blog/${item.slug}`, locale),
      );
    }
    if (languages.en) languages["x-default"] = languages.en;

    for (const locale of routing.locales) {
      const item = group[locale];
      const url = languages[locale];
      if (!item || !url) continue;
      const modified = item.modified ? new Date(item.modified) : undefined;
      entries.push({
        url,
        lastModified:
          modified && !Number.isNaN(modified.getTime()) ? modified : undefined,
        alternates: { languages },
      });
    }
  }
  return entries;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const site = await requestSite();
  if (isMarketingHostname(site.host)) {
    const articles = (
      await Promise.all(
        routing.locales.map((locale) => fetchPublishedArticles(locale)),
      )
    ).flat();
    return [
      ...MARKETING_PATHS.flatMap((path) => localized(MARKETING_ORIGIN, path)),
      ...localized(MARKETING_ORIGIN, "/blog"),
      ...articleEntries(articles),
    ];
  }
  return [];
}
