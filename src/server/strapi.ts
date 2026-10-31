import "server-only";

import { env } from "~/env";

export type StrapiMedia = {
  url: string;
  alternativeText: string | null;
  width: number | null;
  height: number | null;
};

export type ArticleLocalization = {
  slug: string;
  locale: string;
};

export type StrapiArticle = {
  documentId: string;
  title: string;
  slug: string;
  locale?: string;
  excerpt: string | null;
  publishedAt: string | null;
  updatedAt?: string | null;
  cover: StrapiMedia | null;
  tags?: unknown;
  body?: unknown;
  localizations?: ArticleLocalization[] | null;
};

export function articleLocalizations(article: {
  localizations?: unknown;
}): ArticleLocalization[] {
  const value = article.localizations;
  const list = Array.isArray(value)
    ? value
    : value &&
        typeof value === "object" &&
        "data" in value &&
        Array.isArray(value.data)
      ? value.data
      : [];

  return list.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const slug = typeof record.slug === "string" ? record.slug : null;
    const locale = typeof record.locale === "string" ? record.locale : null;
    if (!slug || !locale) return [];
    return [{ slug, locale }];
  });
}

type StrapiListResponse<T> = {
  data: T[];
  meta: { pagination: { pageCount: number } };
};

function strapiBaseUrl() {
  return env.STRAPI_URL?.replace(/\/$/, "") ?? null;
}

async function strapiFetch<T>(path: string): Promise<T | null> {
  const base = strapiBaseUrl();
  if (!base) {
    return null;
  }

  const headers: HeadersInit = { Accept: "application/json" };
  if (env.STRAPI_API_TOKEN) {
    headers.Authorization = `Bearer ${env.STRAPI_API_TOKEN}`;
  }

  try {
    const response = await fetch(`${base}${path}`, {
      headers,
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      console.error(`Strapi request failed: ${response.status} ${path}`);
      return null;
    }

    return (await response.json()) as T;
  } catch (error) {
    console.error(`Strapi request failed: ${path}`, error);
    return null;
  }
}

export async function fetchArticles(
  locale: string,
  page: number,
  tag?: string,
) {
  const params = new URLSearchParams({
    populate: "cover",
    locale: locale,
    status: "published",
    sort: "publishedAt:desc",
    "pagination[page]": String(page),
    "pagination[pageSize]": "5",
  });
  if (tag) params.set("tag", tag);
  const result = await strapiFetch<StrapiListResponse<StrapiArticle>>(
    `/api/articles?${params.toString()}`,
  );
  return {
    articles: result?.data ?? [],
    pageCount: result?.meta.pagination.pageCount ?? 0,
  };
}

async function fetchArticleList(params: URLSearchParams) {
  return strapiFetch<StrapiListResponse<StrapiArticle>>(
    `/api/articles?${params.toString()}`,
  );
}

export async function fetchArticleBySlug(
  slug: string,
  locale: string,
): Promise<StrapiArticle | null> {
  const shared = {
    "filters[slug][$eq]": slug,
    locale,
    status: "published",
    "pagination[pageSize]": "1",
  };
  const result =
    (await fetchArticleList(
      new URLSearchParams({
        ...shared,
        "populate[cover]": "true",
        "populate[localizations][fields][0]": "slug",
        "populate[localizations][fields][1]": "locale",
      }),
    )) ??
    (await fetchArticleList(
      new URLSearchParams({ ...shared, populate: "cover" }),
    ));
  return result?.data[0] ?? null;
}

/** Every published article in one locale, including the other locale's slug. */
export async function fetchPublishedArticles(
  locale: string,
): Promise<StrapiArticle[]> {
  const articles: StrapiArticle[] = [];
  const pageSize = 100;

  for (let page = 1; page <= 20; page++) {
    const params = new URLSearchParams({
      locale,
      status: "published",
      "fields[0]": "slug",
      "fields[1]": "updatedAt",
      "fields[2]": "publishedAt",
      "fields[3]": "locale",
      "populate[localizations][fields][0]": "slug",
      "populate[localizations][fields][1]": "locale",
      "pagination[page]": String(page),
      "pagination[pageSize]": String(pageSize),
    });
    const result =
      (await fetchArticleList(params)) ??
      (page === 1
        ? await fetchArticleList(
            new URLSearchParams({
              locale,
              status: "published",
              "fields[0]": "slug",
              "fields[1]": "updatedAt",
              "fields[2]": "publishedAt",
              "fields[3]": "locale",
              "pagination[page]": String(page),
              "pagination[pageSize]": String(pageSize),
            }),
          )
        : null);
    const batch = result?.data ?? [];
    articles.push(...batch);
    const pageCount = result?.meta.pagination.pageCount ?? 0;
    if (batch.length === 0 || page >= pageCount) break;
  }

  return articles;
}
