import { getTranslations } from "next-intl/server";

import { Link } from "~/i18n/navigation";

export async function MarketingFooter() {
  const tos = await getTranslations("Tos");
  const privacy = await getTranslations("PrivacyPolicy");
  const refund = await getTranslations("RefundPolicy");
  const footer = await getTranslations("MarketingFooter");

  return (
    <footer className="border-border text-muted-foreground border-t px-6 py-8 text-center text-sm">
      <nav className="text-foreground flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-base font-semibold">
        <Link href="/tos" className="py-1 underline-offset-4 hover:underline">
          {tos("title")}
        </Link>
        <Link
          href="/privacy-policy"
          className="py-1 underline-offset-4 hover:underline"
        >
          {privacy("title")}
        </Link>
        <Link
          href="/refund-policy"
          className="py-1 underline-offset-4 hover:underline"
        >
          {refund("title")}
        </Link>
      </nav>
      <div className="mx-auto mt-6 max-w-2xl space-y-3 text-left text-sm leading-6">
        <p>{footer("trademarks")}</p>
        <p>{footer("coverage")}</p>
      </div>
    </footer>
  );
}
