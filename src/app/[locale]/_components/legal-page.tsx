import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { LegalMarkdown } from "./legal-markdown";
import { MarketingFooter } from "./marketing-footer";
import { MarketingHeader } from "./marketing-header";
import { type LegalDocumentId, readLegalMarkdown } from "~/lib/legal-document";

type LegalNamespace = "Tos" | "PrivacyPolicy" | "RefundPolicy";

export async function legalMetadata(
  namespace: LegalNamespace,
): Promise<Metadata> {
  const t = await getTranslations(namespace);

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export async function LegalPage({
  namespace,
  document,
}: {
  namespace: LegalNamespace;
  document: LegalDocumentId;
}) {
  const t = await getTranslations(namespace);
  const locale = await getLocale();
  const content = await readLegalMarkdown(document, locale);

  return (
    <div className="bg-background relative flex min-h-dvh flex-col">
      <MarketingHeader />
      <main className="flex flex-1 flex-col items-center px-6 py-16 sm:py-24">
        <h1 className="max-w-4xl text-center text-5xl font-extrabold tracking-tight text-balance sm:text-6xl md:text-7xl">
          {t("title")}
        </h1>
        <article className="mt-12 w-full max-w-2xl sm:mt-16">
          <LegalMarkdown blocks={content} />
        </article>
      </main>
      <MarketingFooter />
    </div>
  );
}
