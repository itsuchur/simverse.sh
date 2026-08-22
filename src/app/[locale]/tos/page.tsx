import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LegalCloseButton } from "../_components/legal-close-button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Tos");

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function TermsOfService() {
  const t = await getTranslations("Tos");

  return (
    <>
      <LegalCloseButton />
      <main className="mx-auto w-full max-w-2xl px-4 py-10 pr-14">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t("lastUpdated")}</p>

        <section className="mt-6 space-y-4 text-sm leading-6">
          <p>{t("intro")}</p>
          <h2 className="text-lg font-medium">{t("serviceTitle")}</h2>
          <p>{t("service")}</p>
          <h2 className="text-lg font-medium">{t("paymentsTitle")}</h2>
          <p>{t("payments")}</p>
          <h2 className="text-lg font-medium">{t("acceptableUseTitle")}</h2>
          <p>{t("acceptableUse")}</p>
          <h2 className="text-lg font-medium">{t("contactTitle")}</h2>
          <p>{t("contact")}</p>
        </section>
      </main>
    </>
  );
}
