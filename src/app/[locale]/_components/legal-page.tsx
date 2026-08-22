import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LegalCloseButton } from "./legal-close-button";
import { LegalMarkdown } from "./legal-markdown";
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
  const content = await readLegalMarkdown(document);

  return (
    <>
      <LegalCloseButton />
      <main className="mx-auto w-full max-w-2xl px-4 py-10 pr-14">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t("lastUpdated")}</p>
        <LegalMarkdown blocks={content} />
      </main>
    </>
  );
}
