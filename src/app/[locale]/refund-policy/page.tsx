import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("RefundPolicy");

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function RefundPolicy() {
  const t = await getTranslations("RefundPolicy");

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <p className="text-muted-foreground mt-2 text-sm">{t("lastUpdated")}</p>

      <section className="mt-6 space-y-4 text-sm leading-6">
        <p>{t("intro")}</p>
        <h2 className="text-lg font-medium">{t("eligibleTitle")}</h2>
        <p>{t("eligible")}</p>
        <h2 className="text-lg font-medium">{t("notEligibleTitle")}</h2>
        <p>{t("notEligible")}</p>
        <h2 className="text-lg font-medium">{t("requestTitle")}</h2>
        <p>{t("request")}</p>
      </section>
    </main>
  );
}
