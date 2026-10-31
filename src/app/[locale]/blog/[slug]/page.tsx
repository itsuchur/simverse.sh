import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { isAppLocale } from "~/i18n/preferred-locale";
import { Link } from "~/i18n/navigation";
import { articleTags } from "~/lib/article-tags";
import { articleAlternates, MARKETING_ORIGIN } from "~/lib/public-url";
import { articleLocalizations, fetchArticleBySlug } from "~/server/strapi";

import { ArticleBody } from "../_components/article-body";
import { ArticleCover } from "../_components/article-cover";
import { ArticleTags } from "../_components/article-tags";
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
    return {
      title: t("notFoundTitle"),
      robots: { index: false, follow: true },
    };
  }

  const slugs: Partial<Record<"en" | "ru", string>> = {};
  if (isAppLocale(locale)) slugs[locale] = article.slug;
  for (const localization of articleLocalizations(article)) {
    if (isAppLocale(localization.locale) && localization.slug) {
      slugs[localization.locale] = localization.slug;
    }
  }

  return {
    title: article.title,
    description: article.excerpt ?? t("metaDescription"),
    keywords: articleTags(article.tags),
    alternates: isAppLocale(locale)
      ? articleAlternates(MARKETING_ORIGIN, locale, slugs)
      : undefined,
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
  const listPath = "/blog";

  if (!article) {
    notFound();
  }

  return (
    <BlogShell>
      <p className="mb-10 text-center">
        <Link
          href={listPath}
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
        >
          {t("back")}
        </Link>
      </p>
      <article className="mx-auto max-w-2xl">
        <h1 className="text-center text-4xl font-extrabold tracking-tight text-balance sm:text-5xl md:text-6xl">
          {article.title}
        </h1>
        {article.publishedAt ? (
          <time
            dateTime={article.publishedAt}
            className="text-muted-foreground mt-6 block text-center text-sm"
          >
            {format.dateTime(new Date(article.publishedAt), {
              dateStyle: "medium",
            })}
          </time>
        ) : null}
        <ArticleTags tags={article.tags} listPath={listPath} />
        <div className="mt-8">
          <ArticleCover cover={article.cover} title={article.title} preload />
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
