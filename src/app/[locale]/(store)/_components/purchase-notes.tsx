import { getLocale, getTranslations } from "next-intl/server";

import { catalogCurrency } from "~/lib/catalog-price";
import { Link } from "~/i18n/navigation";

const linkClassName = "underline underline-offset-4";

/** Currency, fee and legal notes shown next to prices and at checkout. */
export async function PurchaseNotes() {
  const t = await getTranslations("Store");
  const locale = await getLocale();

  return (
    <div className="text-muted-foreground space-y-2 text-sm leading-6">
      <p>{t("pricesNote", { currency: catalogCurrency(locale) })}</p>
      <p>
        {t.rich("legalNote", {
          tos: (chunks) => (
            <Link href="/tos" className={linkClassName}>
              {chunks}
            </Link>
          ),
          refund: (chunks) => (
            <Link href="/refund-policy" className={linkClassName}>
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
