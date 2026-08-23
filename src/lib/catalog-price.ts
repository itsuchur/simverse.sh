import type { CatalogPackage } from "~/server/suppliers/esimaccess/catalog-types";

export function catalogCurrency(locale: string): "RUB" | "USD" {
  return locale === "ru" ? "RUB" : "USD";
}

export function catalogPriceAmount(
  pkg: Pick<CatalogPackage, "priceRub" | "priceUsd">,
  locale: string,
): number | undefined {
  const amount = locale === "ru" ? pkg.priceRub : pkg.priceUsd;
  return typeof amount === "number" && Number.isFinite(amount)
    ? amount
    : undefined;
}

export function catalogNumberFormatOptions(
  locale: string,
): Intl.NumberFormatOptions {
  const currency = catalogCurrency(locale);
  if (currency === "RUB") {
    return {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    };
  }

  return {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
  };
}

export function lowestCatalogPrice(
  packages: Pick<CatalogPackage, "priceRub" | "priceUsd">[],
  locale: string,
): number | undefined {
  const prices = packages
    .map((pkg) => catalogPriceAmount(pkg, locale))
    .filter((price): price is number => typeof price === "number");
  if (prices.length === 0) {
    return undefined;
  }
  return Math.min(...prices);
}
