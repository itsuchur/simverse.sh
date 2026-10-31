import { getTranslations } from "next-intl/server";

import { Link } from "~/i18n/navigation";

import { BlogShell } from "../_components/blog-shell";

export default async function BlogArticleNotFound() {
  const t = await getTranslations("Blog");
  const listPath = "/blog";

  return (
    <BlogShell>
      <h1 className="text-center text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
        {t("notFoundTitle")}
      </h1>
      <p className="mt-6 text-center">
        <Link
          href={listPath}
          className="text-muted-foreground hover:text-foreground text-sm underline-offset-4 hover:underline"
        >
          {t("back")}
        </Link>
      </p>
    </BlogShell>
  );
}
