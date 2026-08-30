import { getTranslations } from "next-intl/server";

import { Link } from "~/i18n/navigation";

import { BlogShell } from "../_components/blog-shell";

export default async function BlogArticleNotFound() {
  const t = await getTranslations("Blog");

  return (
    <BlogShell title={t("title")}>
      <h1 className="text-3xl font-extrabold tracking-tight">
        {t("notFoundTitle")}
      </h1>
      <p className="mt-6">
        <Link
          href="/blog"
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
        >
          {t("back")}
        </Link>
      </p>
    </BlogShell>
  );
}
