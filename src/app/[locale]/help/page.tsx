import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { LegalCloseButton } from "../_components/legal-close-button";

const FAQ_KEYS = [
  "whatIsEsim",
  "deviceSupport",
  "fees",
  "callsAndSms",
] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Help");

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function HelpPage() {
  const t = await getTranslations("Help");

  return (
    <>
      <LegalCloseButton />
      <main className="mx-auto w-full max-w-2xl px-4 py-10 pr-14">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t("intro")}</p>

        <section className="mt-6 space-y-6 text-sm leading-6">
          {FAQ_KEYS.map((key) => (
            <article key={key} className="space-y-2">
              <h2 className="text-lg font-medium">{t(`${key}Title`)}</h2>
              <p>
                {t.rich(key, {
                  code: (chunks) => (
                    <code className="bg-muted rounded px-1 py-0.5 font-mono text-[0.8125rem]">
                      {chunks}
                    </code>
                  ),
                })}
              </p>
            </article>
          ))}
        </section>
      </main>
    </>
  );
}
