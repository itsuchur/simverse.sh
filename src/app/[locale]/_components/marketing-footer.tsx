import { getTranslations } from "next-intl/server";

import { Link } from "~/i18n/navigation";

export async function MarketingFooter() {
  const tos = await getTranslations("Tos");
  const privacy = await getTranslations("PrivacyPolicy");
  const refund = await getTranslations("RefundPolicy");

  return (
    <footer className="border-border text-muted-foreground border-t px-6 py-8 text-center text-sm">
      <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        <Link
          href="/tos"
          className="hover:text-foreground underline-offset-4 hover:underline"
        >
          {tos("title")}
        </Link>
        <Link
          href="/privacy-policy"
          className="hover:text-foreground underline-offset-4 hover:underline"
        >
          {privacy("title")}
        </Link>
        <Link
          href="/refund-policy"
          className="hover:text-foreground underline-offset-4 hover:underline"
        >
          {refund("title")}
        </Link>
      </nav>
    </footer>
  );
}
