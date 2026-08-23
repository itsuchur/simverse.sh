import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { FullScreenDocument } from "./full-screen-document";
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
    <FullScreenDocument title={t("title")}>
      <p className="text-muted-foreground text-sm">{t("lastUpdated")}</p>
      <LegalMarkdown blocks={content} />
    </FullScreenDocument>
  );
}
