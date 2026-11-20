import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import ReactCountryFlag from "react-country-flag";

import { Link } from "~/i18n/navigation";
import {
  catalogNumberFormatOptions,
  lowestCatalogPrice,
} from "~/lib/catalog-price";
import { countrySlug } from "~/lib/country-slug";
import { countriesWithPlans, regionalGroups } from "~/lib/public-catalog";
import type { CatalogPackage } from "~/server/suppliers/esimaccess/catalog-types";
import { getStoreCatalog } from "~/server/suppliers/esimaccess/packages";

import { CountryDirectory } from "../_components/country-directory";
import { PlanTable } from "../_components/plan-table";
import { PurchaseNotes } from "../_components/purchase-notes";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Store");
  return {
    title: t("catalogMetaTitle"),
    description: t("catalogMetaDescription"),
  };
}

export default async function EsimCatalogPage() {
  const t = await getTranslations("Store");
  const tCatalog = await getTranslations("Catalog");
  const format = await getFormatter();
  const locale = await getLocale();
  const catalog = await getStoreCatalog(locale);
  const priceFormat = catalogNumberFormatOptions(locale);

  const fromPrice = (packages: CatalogPackage[]) => {
    const amount = lowestCatalogPrice(packages, locale);
    return amount === undefined
      ? null
      : tCatalog("fromPrice", { price: format.number(amount, priceFormat) });
  };

  const countries = countriesWithPlans(catalog).map((group) => ({
    code: group.countryCode,
    name: group.countryName,
    slug: countrySlug(group.countryCode),
    fromPrice: fromPrice(group.packages),
  }));
  const popular = catalog.popular.filter((group) => group.packages.length > 0);
  const regions = regionalGroups(catalog, locale);

  return (
    <main className="space-y-14">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
          {t("catalogTitle")}
        </h1>
        <p className="text-muted-foreground text-lg leading-8">
          {t("catalogIntro")}
        </p>
        <PurchaseNotes />
      </header>

      {popular.length > 0 ? (
        <section aria-labelledby="popular" className="space-y-5">
          <h2 id="popular" className="text-2xl font-bold tracking-tight">
            {t("popularHeading")}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {popular.map((group) => (
              <li key={group.countryCode}>
                <Link
                  href={`/esim/${countrySlug(group.countryCode)}`}
                  className="hover:bg-muted/60 border-border flex h-full flex-col gap-3 rounded-xl border p-4 transition-colors"
                >
                  <ReactCountryFlag
                    countryCode={group.countryCode}
                    svg
                    style={{ width: "2em", height: "2em" }}
                    aria-hidden
                  />
                  <span className="font-semibold">{group.countryName}</span>
                  <span className="text-muted-foreground text-sm">
                    {fromPrice(group.packages)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="countries" className="space-y-5">
        <h2 id="countries" className="text-2xl font-bold tracking-tight">
          {t("countriesHeading")}
        </h2>
        <CountryDirectory
          countries={countries}
          searchLabel={t("searchLabel")}
          searchPlaceholder={t("searchPlaceholder")}
          noMatches={t("noMatches")}
        />
      </section>

      {regions.length > 0 ? (
        <section aria-labelledby="regional" className="space-y-5">
          <h2 id="regional" className="text-2xl font-bold tracking-tight">
            {t("regionalHeading")}
          </h2>
          <div className="space-y-3">
            {regions.map((group) => (
              <details
                key={group.id}
                className="border-border rounded-xl border"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 font-semibold [&::-webkit-details-marker]:hidden">
                  <span>{group.title}</span>
                  <span className="text-muted-foreground text-sm font-normal whitespace-nowrap">
                    {fromPrice(group.packages)}
                  </span>
                </summary>
                <div className="px-2 pb-2">
                  <PlanTable packages={group.packages} />
                </div>
              </details>
            ))}
          </div>
        </section>
      ) : null}

      {catalog.global.length > 0 ? (
        <section aria-labelledby="global" className="space-y-5">
          <h2 id="global" className="text-2xl font-bold tracking-tight">
            {t("globalHeading")}
          </h2>
          <PlanTable packages={catalog.global} />
        </section>
      ) : null}
    </main>
  );
}
