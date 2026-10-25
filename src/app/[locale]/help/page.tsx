import type { Metadata } from "next";
import { Fragment } from "react";
import { getTranslations } from "next-intl/server";

import { FAQ_KEYS } from "../_components/faq-keys";
import { FullScreenDocument } from "../_components/full-screen-document";

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
    <FullScreenDocument
      title={t("title")}
      showCloseButton={false}
      showBackButton
    >
      <div className="text-muted-foreground space-y-4 text-sm leading-6 wrap-break-word">
        <p>{t("intro")}</p>
        {FAQ_KEYS.map((key) => (
          <Fragment key={key}>
            <h2 className="text-foreground mt-10 text-2xl font-extrabold tracking-tight sm:text-3xl">
              {t(`${key}Title`)}
            </h2>
            <p>
              {t.rich(key, {
                code: (chunks) => (
                  <code className="bg-muted rounded px-1 py-0.5 font-mono text-[0.8125rem]">
                    {chunks}
                  </code>
                ),
              })}
            </p>
          </Fragment>
        ))}
      </div>
    </FullScreenDocument>
  );
}
