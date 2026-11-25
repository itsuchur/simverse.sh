import type { Metadata } from "next";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";
import { ChevronDown } from "lucide-react";

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
import { FlagBadge } from "../_components/flag-badge";
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
    <main className="space-y-16">
      <header className="space-y-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-balance sm:text-6xl">
          {t("catalogTitle")}
        </h1>
        <p className="text-muted-foreground max-w-3xl text-lg leading-8 sm:text-xl sm:leading-9">
          {t("catalogIntro")}
        </p>
        <PurchaseNotes />
      </header>

      {popular.length > 0 ? (
        <section aria-labelledby="popular" className="space-y-6">
          <h2 id="popular" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t("popularHeading")}
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {popular.map((group) => (
              <li key={group.countryCode}>
                <Link
                  href={`/esim/${countrySlug(group.countryCode)}`}
                  className="border-border bg-card hover:border-foreground/25 flex h-full flex-col gap-4 rounded-2xl border p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-6"
                >
                  <FlagBadge countryCode={group.countryCode} height="2.25rem" />
                  <span className="text-lg leading-tight font-bold">
                    {group.countryName}
                  </span>
                  <span className="mt-auto text-base font-semibold">
                    {fromPrice(group.packages)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="countries" className="space-y-6">
        <h2 id="countries" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
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
        <section aria-labelledby="regional" className="space-y-6">
          <h2 id="regional" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t("regionalHeading")}
          </h2>
          <div className="space-y-3">
            {regions.map((group) => (
              <details
                key={group.id}
                className="group border-border bg-card rounded-2xl border shadow-sm"
              >
                <summary className="hover:bg-muted/40 flex cursor-pointer list-none items-center gap-4 rounded-2xl px-5 py-4 text-lg font-bold [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1">{group.title}</span>
                  <span className="text-base font-semibold whitespace-nowrap">
                    {fromPrice(group.packages)}
                  </span>
                  <ChevronDown
                    className="text-muted-foreground size-5 shrink-0 transition-transform group-open:rotate-180"
                    aria-hidden
                  />
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
        <section aria-labelledby="global" className="space-y-6">
          <h2 id="global" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t("globalHeading")}
          </h2>
          <PlanTable packages={catalog.global} />
        </section>
      ) : null}
    </main>
  );
}
