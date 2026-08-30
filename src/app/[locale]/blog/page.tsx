import type { Metadata } from "next";
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

export default async function BlogPage() {
  const t = await getTranslations("Blog");
  const format = await getFormatter();
  const locale = await getLocale();
  const articles = await fetchArticles(locale);

  return (
    <BlogShell title={t("title")}>
      <h1 className="text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
        {t("title")}
      </h1>
      <p className="text-muted-foreground mt-3 max-w-2xl text-base">
        {t("intro")}
      </p>

      {articles.length === 0 ? (
        <p className="text-muted-foreground mt-12 text-sm">{t("empty")}</p>
      ) : (
        <ul className="mt-12 space-y-10">
          {articles.map((article) => (
            <li key={article.documentId}>
              <Link href={`/blog/${article.slug}`} className="group block">
                <ArticleCover cover={article.cover} title={article.title} />
                <h2 className="group-hover:text-foreground mt-4 text-2xl font-bold tracking-tight">
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
    </BlogShell>
  );
}
