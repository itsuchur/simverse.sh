import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { CoverageList } from "~/app/[locale]/app/_components/coverage-list";
import { Link } from "~/i18n/navigation";
import {
  catalogNumberFormatOptions,
  lowestCatalogPrice,
} from "~/lib/catalog-price";
import { countryCodeForSlug } from "~/lib/country-slug";
import { countriesWithPlans, plansCoveringCountry } from "~/lib/public-catalog";
import { getStoreCatalog } from "~/server/suppliers/esimaccess/packages";

import { FlagBadge } from "../../_components/flag-badge";
import { PlanTable } from "../../_components/plan-table";
import { PurchaseNotes } from "../../_components/purchase-notes";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ country: string }> };

async function loadCountry(slug: string) {
  const locale = await getLocale();
  const catalog = await getStoreCatalog(locale);
  const countries = countriesWithPlans(catalog);
  const code = countryCodeForSlug(
    slug,
    countries.map((group) => group.countryCode),
  );
  const group = countries.find((entry) => entry.countryCode === code);
  if (!group) notFound();
  return { locale, catalog, group };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country } = await params;
  const { locale, group } = await loadCountry(country);
  const t = await getTranslations("Store");
  const format = await getFormatter();
  const amount = lowestCatalogPrice(group.packages, locale);
  const price =
    amount === undefined
      ? ""
      : format.number(amount, catalogNumberFormatOptions(locale));
  return {
    title: t("countryMetaTitle", { country: group.countryName }),
    description: t("countryMetaDescription", {
      country: group.countryName,
      price,
    }),
  };
}

export default async function CountryPlansPage({ params }: Props) {
  const { country } = await params;
  const { locale, catalog, group } = await loadCountry(country);
  const t = await getTranslations("Store");
  const tCatalog = await getTranslations("Catalog");
  const covering = plansCoveringCountry(
    catalog,
    group.countryCode,
    locale,
    tCatalog("tabs.global"),
  );

  return (
    <main className="space-y-12">
      <Link
        href="/esim"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-base font-medium"
      >
        <ChevronLeft className="size-5" aria-hidden />
        {t("allDestinations")}
      </Link>

      <header className="space-y-4">
        <div className="flex items-center gap-5">
          <FlagBadge countryCode={group.countryCode} height="3rem" />
          <h1 className="text-4xl font-extrabold tracking-tight text-balance sm:text-5xl">
            {t("countryTitle", { country: group.countryName })}
          </h1>
        </div>
        <p className="text-muted-foreground max-w-3xl text-lg leading-8 sm:text-xl sm:leading-9">
          {t("countryIntro", { country: group.countryName })}
        </p>
        <PurchaseNotes />
      </header>

      <section aria-labelledby="local-plans" className="space-y-6">
        <h2 id="local-plans" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {t("localPlansHeading", { country: group.countryName })}
        </h2>
        <PlanTable packages={group.packages} />
      </section>

      <section aria-labelledby="networks" className="space-y-4">
        <h2 id="networks" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          {t("networksHeading")}
        </h2>
        <CoverageList
          packages={group.packages}
          locale={locale}
          showCountry={false}
        />
      </section>

      {covering.length > 0 ? (
        <section aria-labelledby="covering" className="space-y-6">
          <h2 id="covering" className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            {t("coveringPlansHeading", { country: group.countryName })}
          </h2>
          <div className="space-y-3">
            {covering.map((plans) => (
              <details
                key={plans.id}
                className="group border-border bg-card rounded-2xl border shadow-sm"
              >
                <summary className="hover:bg-muted/40 flex cursor-pointer list-none items-center gap-4 rounded-2xl px-5 py-4 text-lg font-bold [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0 flex-1">{plans.title}</span>
                  <ChevronDown
                    className="text-muted-foreground size-5 shrink-0 transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                </summary>
                <div className="px-2 pb-2">
                  <PlanTable packages={plans.packages} />
                </div>
              </details>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
