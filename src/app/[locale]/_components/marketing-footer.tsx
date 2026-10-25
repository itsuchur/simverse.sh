import { getLocale, getTranslations } from "next-intl/server";

import { marketingLegalUrl, type LegalPath } from "~/lib/marketing-url";

const linkClassName = "py-1 underline-offset-4 hover:underline";

export async function MarketingFooter() {
  const tos = await getTranslations("Tos");
  const privacy = await getTranslations("PrivacyPolicy");
  const refund = await getTranslations("RefundPolicy");
  const footer = await getTranslations("MarketingFooter");
  const locale = await getLocale();
  const legalHref = (href: LegalPath) => marketingLegalUrl(href, locale);

  return (
    <footer className="border-border text-muted-foreground border-t px-6 py-8 text-center text-sm">
      <nav className="text-foreground flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-base font-semibold">
        <a href={legalHref("/tos")} className={linkClassName}>
          {tos("title")}
        </a>
        <a href={legalHref("/privacy-policy")} className={linkClassName}>
          {privacy("title")}
        </a>
        <a href={legalHref("/refund-policy")} className={linkClassName}>
          {refund("title")}
        </a>
      </nav>
      <div className="mx-auto mt-6 max-w-2xl space-y-3 text-left text-sm leading-6">
        <p>{footer("trademarks")}</p>
        <p>{footer("coverage")}</p>
      </div>
    </footer>
  );
}
