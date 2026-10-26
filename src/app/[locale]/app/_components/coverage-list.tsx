"use client";

import { displayedCountries } from "~/lib/displayed-countries";

import { useTranslations } from "next-intl";
import ReactCountryFlag from "react-country-flag";
import type { CatalogPackage } from "~/server/suppliers/esimaccess/catalog-types";

type CoveragePackage = Pick<CatalogPackage, "location" | "coverage">;

function countryDisplayName(countryCode: string, locale: string) {
  try {
    return (
      new Intl.DisplayNames([locale], { type: "region" }).of(countryCode) ??
      countryCode
    );
  } catch {
    return countryCode;
  }
}

export function CoverageList({
  packages,
  locale,
  showCountry = true,
}: {
  packages: CoveragePackage[];
  locale: string;
  showCountry?: boolean;
}) {
  const t = useTranslations("Catalog");
  const countries = displayedCountries(packages)
    .map((code) => ({ code, name: countryDisplayName(code, locale) }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));
  return (
    <ul className="divide-border divide-y">
      {countries.map(({ code, name }) => {
        const operators = new Map<string, Set<string>>();
        for (const pkg of packages) {
          for (const country of pkg.coverage ?? []) {
            if (country.countryCode !== code) continue;
            for (const operator of country.operators) {
              const types =
                operators.get(operator.operatorName) ?? new Set<string>();
              operator.networkTypes.forEach((type) => types.add(type));
              operators.set(operator.operatorName, types);
            }
          }
        }
        return (
          <li
            key={code}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 py-4 first:pt-0 last:pb-0"
          >
            {showCountry && (
              <div className="flex min-w-0 items-center gap-3 font-medium">
                <ReactCountryFlag
                  countryCode={code}
                  svg
                  className="shrink-0 rounded-sm"
                  style={{ width: "2rem", height: "1.5rem" }}
                  aria-hidden
                />
                <span>{name}</span>
              </div>
            )}
            {operators.size ? (
              <ul
                className={
                  showCountry ? "ml-auto space-y-2" : "w-full space-y-2"
                }
              >
                {[...operators].map(([operator, types]) => (
                  <li
                    key={operator}
                    className={`text-muted-foreground flex items-center gap-2 text-sm ${showCountry ? "justify-end" : "justify-between"}`}
                  >
                    <span className={showCountry ? "text-right" : undefined}>
                      {operator}
                    </span>
                    <span className="flex shrink-0 gap-1">
                      {[...types].sort().map((type) => (
                        <span
                          key={type}
                          className="border-border inline-flex h-6 w-9 items-center justify-center rounded border"
                          role="img"
                          aria-label={type}
                        >
                          <span
                            className="h-3 w-5 bg-current"
                            style={{
                              mask: `url(/${type}.svg) center / contain no-repeat`,
                            }}
                          />
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <span
                className={`text-muted-foreground text-sm ${showCountry ? "ml-auto text-right" : ""}`}
              >
                {t("networksUnavailable")}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
