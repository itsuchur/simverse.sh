import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { Link } from "~/i18n/navigation";
import { fetchArticleBySlug } from "~/server/strapi";

import { ArticleBody } from "../_components/article-body";
import { ArticleCover } from "../_components/article-cover";
import { BlogShell } from "../_components/blog-shell";

type BlogArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({
  params,
}: BlogArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const locale = await getLocale();
  const article = await fetchArticleBySlug(slug, locale);
  const t = await getTranslations("Blog");

  if (!article) {
    return { title: t("notFoundTitle") };
  }

  return {
    title: article.title,
    description: article.excerpt ?? t("metaDescription"),
  };
}

export default async function BlogArticlePage({
  params,
}: BlogArticlePageProps) {
  const { slug } = await params;
  const locale = await getLocale();
  const t = await getTranslations("Blog");
  const format = await getFormatter();
  const article = await fetchArticleBySlug(slug, locale);

  if (!article) {
    notFound();
  }

  return (
    <BlogShell title={t("title")}>
      <p className="mb-8">
        <Link
          href="/blog"
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
        >
          {t("back")}
        </Link>
      </p>
      <article>
        <h1 className="text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
          {article.title}
        </h1>
        {article.publishedAt ? (
          <time
            dateTime={article.publishedAt}
            className="text-muted-foreground mt-3 block text-sm"
          >
            {format.dateTime(new Date(article.publishedAt), {
              dateStyle: "medium",
            })}
          </time>
        ) : null}
        <div className="mt-8">
          <ArticleCover cover={article.cover} title={article.title} priority />
        </div>
        {article.excerpt ? (
          <p className="text-muted-foreground mt-8 text-lg leading-7">
            {article.excerpt}
          </p>
        ) : null}
        <div className="mt-8">
          <ArticleBody content={article.body} />
        </div>
      </article>
    </BlogShell>
  );
}
