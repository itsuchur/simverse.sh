import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { buttonVariants } from "~/components/ui/button";
import { UnlimitedDataLabel } from "~/components/ui/unlimited-data-label";
import { Link } from "~/i18n/navigation";
import {
  catalogNumberFormatOptions,
  catalogPriceAmount,
} from "~/lib/catalog-price";
import { formatVolume, sortPlans } from "~/lib/public-catalog";
import type { CatalogPackage } from "~/server/suppliers/esimaccess/catalog-types";

/** Server-rendered price list: every plan with its data, validity and price. */
export async function PlanTable({
  packages,
}: {
  packages: readonly CatalogPackage[];
}) {
  const t = await getTranslations("Store");
  const tCatalog = await getTranslations("Catalog");
  const format = await getFormatter();
  const locale = await getLocale();
  const priceFormat = catalogNumberFormatOptions(locale);

  return (
    <div className="border-border overflow-x-auto rounded-xl border">
      <table className="w-full text-left text-base">
        <thead className="bg-muted/50 text-muted-foreground text-sm">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">
              {t("colData")}
            </th>
            <th scope="col" className="px-4 py-3 font-medium">
              {t("colValidity")}
            </th>
            <th scope="col" className="px-4 py-3 text-right font-medium">
              {t("colPrice")}
            </th>
            <th scope="col" className="px-4 py-3">
              <span className="sr-only">{t("buy")}</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {sortPlans(packages).map((pkg) => {
            const amount = catalogPriceAmount(pkg, locale);
            const price =
              amount === undefined ? null : format.number(amount, priceFormat);
            const data = formatVolume(pkg.volume);
            const validity = tCatalog("duration.day", { count: pkg.duration });
            return (
              <tr key={pkg.packageCode}>
                <td className="px-4 py-3">
                  {pkg.isUnlimited ? (
                    <UnlimitedDataLabel
                      fullSpeedAmount={data}
                      packageName={pkg.name}
                    />
                  ) : (
                    data
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap">{validity}</td>
                <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                  {price ?? "—"}
                </td>
                <td className="px-4 py-2 text-right">
                  {price ? (
                    <Link
                      href={{
                        pathname: "/checkout",
                        query: { package: pkg.packageCode },
                      }}
                      prefetch={false}
                      aria-label={t("buyLabel", { data, validity, price })}
                      className={buttonVariants({ size: "sm" })}
                    >
                      {t("buy")}
                    </Link>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
