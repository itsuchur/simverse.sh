import "server-only";

import { env } from "~/env";

export type StrapiMedia = {
  url: string;
  alternativeText: string | null;
  width: number | null;
  height: number | null;
};

export type StrapiArticle = {
  documentId: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: string | null;
  cover: StrapiMedia | null;
  body?: unknown;
};

type StrapiListResponse<T> = {
  data: T[];
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

export async function fetchArticles(locale: string): Promise<StrapiArticle[]> {
  const params = new URLSearchParams({
    populate: "cover",
    locale: locale,
    status: "published",
    sort: "publishedAt:desc",
    "pagination[pageSize]": "50",
  });
  const result = await strapiFetch<StrapiListResponse<StrapiArticle>>(
    `/api/articles?${params.toString()}`,
  );
  return result?.data ?? [];
}

export async function fetchArticleBySlug(
  slug: string,
  locale: string,
): Promise<StrapiArticle | null> {
  const params = new URLSearchParams({
    "filters[slug][$eq]": slug,
    populate: "cover",
    locale: locale,
    status: "published",
    "pagination[pageSize]": "1",
  });
  const result = await strapiFetch<StrapiListResponse<StrapiArticle>>(
    `/api/articles?${params.toString()}`,
  );
  return result?.data[0] ?? null;
}
