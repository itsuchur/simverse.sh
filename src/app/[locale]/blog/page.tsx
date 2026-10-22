import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { Link } from "~/i18n/navigation";
import { fetchArticles } from "~/server/strapi";

import { ArticleCover } from "./_components/article-cover";
import { BlogShell } from "./_components/blog-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Blog");

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = pageParam === undefined ? 1 : Number(pageParam);
  if (Array.isArray(pageParam) || !Number.isSafeInteger(page) || page < 1) {
    notFound();
  }
  const t = await getTranslations("Blog");
  const format = await getFormatter();
  const locale = await getLocale();
  const { articles, pageCount } = await fetchArticles(locale, page);
  if (page > 1 && page > pageCount) {
    notFound();
  }

  return (
    <BlogShell>
      <h1 className="text-center text-5xl font-extrabold tracking-tight text-balance sm:text-6xl md:text-7xl">
        {t("title")}
      </h1>
      <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-center text-base leading-7">
        {t("intro")}
      </p>

      {articles.length === 0 ? (
        <p className="text-muted-foreground mt-16 text-center text-sm">
          {t("empty")}
        </p>
      ) : (
        <ul className="mx-auto mt-16 max-w-2xl space-y-12 sm:mt-20 sm:space-y-16">
          {articles.map((article) => (
            <li key={article.documentId}>
              <Link
                href={`/blog/${article.slug}`}
                className="group focus-visible:outline-ring block rounded-2xl outline-offset-8 focus-visible:outline-2"
              >
                <ArticleCover
                  cover={article.cover}
                  title={article.title}
                  thumbnail
                />
                <h2 className="mt-6 text-2xl font-extrabold tracking-tight text-balance underline-offset-4 group-hover:underline sm:text-3xl">
                  {article.title}
                </h2>
                {article.publishedAt ? (
                  <time
                    dateTime={article.publishedAt}
                    className="text-muted-foreground mt-1 block text-sm"
                  >
                    {format.dateTime(new Date(article.publishedAt), {
                      dateStyle: "medium",
                    })}
                  </time>
                ) : null}
                {article.excerpt ? (
                  <p className="text-muted-foreground mt-2 text-sm leading-6">
                    {article.excerpt}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {pageCount > 1 ? (
        <nav
          aria-label={t("pagination")}
          className="mx-auto mt-12 flex max-w-2xl items-center justify-between gap-4 text-sm"
        >
          {page > 1 ? (
            <Link
              href={{
                pathname: "/blog",
                query: page > 2 ? { page: page - 1 } : {},
              }}
              className="underline-offset-4 hover:underline"
            >
              {t("previous")}
            </Link>
          ) : (
            <span />
          )}
          <span aria-current="page">
            {t("pageOf", { page, total: pageCount })}
          </span>
          {page < pageCount ? (
            <Link
              href={{ pathname: "/blog", query: { page: page + 1 } }}
              className="underline-offset-4 hover:underline"
            >
              {t("next")}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </BlogShell>
  );
}
