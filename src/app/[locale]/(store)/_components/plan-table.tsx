import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { buttonVariants } from "~/components/ui/button";
import { UnlimitedDataLabel } from "~/components/ui/unlimited-data-label";
import { Link } from "~/i18n/navigation";
import { cn } from "~/lib/utils";
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
    <div className="border-border bg-card overflow-x-auto rounded-2xl border shadow-sm">
      <table className="w-full text-left text-base sm:text-lg">
        <thead className="bg-muted/50 text-muted-foreground text-xs tracking-wider uppercase">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold sm:px-5">
              {t("colData")}
            </th>
            <th scope="col" className="px-4 py-3 font-semibold sm:px-5">
              {t("colValidity")}
            </th>
            <th scope="col" className="px-4 py-3 text-right font-semibold sm:px-5">
              {t("colPrice")}
            </th>
            <th scope="col" className="px-4 py-3 sm:px-5">
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
              <tr
                key={pkg.packageCode}
                className="hover:bg-muted/30 transition-colors"
              >
                <td className="px-4 py-4 font-medium sm:px-5">
                  {pkg.isUnlimited ? (
                    <UnlimitedDataLabel
                      fullSpeedAmount={data}
                      packageName={pkg.name}
                    />
                  ) : (
                    data
                  )}
                </td>
                <td className="px-4 py-4 whitespace-nowrap sm:px-5">
                  {validity}
                </td>
                <td className="px-4 py-4 text-right text-lg font-bold whitespace-nowrap sm:px-5 sm:text-xl">
                  {price ?? "—"}
                </td>
                <td className="px-4 py-3 text-right sm:px-5">
                  {price ? (
                    <Link
                      href={{
                        pathname: "/checkout",
                        query: { package: pkg.packageCode },
                      }}
                      prefetch={false}
                      aria-label={t("buyLabel", { data, validity, price })}
                      className={cn(
                        buttonVariants({ size: "lg" }),
                        "h-10 px-5 text-base font-semibold sm:h-11 sm:px-6",
                      )}
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
