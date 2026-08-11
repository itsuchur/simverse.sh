"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Search } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import ReactCountryFlag from "react-country-flag";

import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type {
  CatalogPackage,
  PopularCountryPackages,
  RegionPackages,
} from "~/server/suppliers/esimaccess/catalog-types";

const tabValues = ["popular", "local", "regional", "global"] as const;

function formatVolume(bytes: number) {
  const gib = bytes / 1024 ** 3;
  if (gib >= 1) {
    return Number.isInteger(gib) ? `${gib} GB` : `${gib.toFixed(1)} GB`;
  }
  const mib = bytes / 1024 ** 2;
  return `${Math.round(mib)} MB`;
}

function packageMatches(pkg: CatalogPackage, query: string) {
  return (
    pkg.name.toLowerCase().includes(query) ||
    pkg.nameRu?.toLowerCase().includes(query)
  );
}

function filterCountryGroups(
  groups: PopularCountryPackages[],
  query: string,
): PopularCountryPackages[] {
  if (!query) return groups;

  return groups
    .map((group) => {
      const countryMatch =
        group.countryName.toLowerCase().includes(query) ||
        group.countryCode.toLowerCase().includes(query);

      if (countryMatch) {
        return group;
      }

      return {
        ...group,
        packages: group.packages.filter((pkg) => packageMatches(pkg, query)),
      };
    })
    .filter((group) => group.packages.length > 0);
}

function filterRegionGroups(
  groups: RegionPackages[],
  query: string,
): RegionPackages[] {
  if (!query) return groups;

  return groups
    .map((group) => {
      const labelMatch =
        group.regionLabel.toLowerCase().includes(query) ||
        group.regionLabelRu?.toLowerCase().includes(query);

      if (labelMatch) {
        return group;
      }

      return {
        ...group,
        packages: group.packages.filter((pkg) => packageMatches(pkg, query)),
      };
    })
    .filter((group) => group.packages.length > 0);
}

function lowestPriceRub(packages: CatalogPackage[]) {
  const prices = packages
    .map((pkg) => pkg.priceRub)
    .filter((price): price is number => typeof price === "number");
  if (prices.length === 0) {
    return undefined;
  }
  return Math.min(...prices);
}

function PackageCard({ pkg }: { pkg: CatalogPackage }) {
  const t = useTranslations("Catalog");
  const format = useFormatter();
  const locale = useLocale();

  const price =
    typeof pkg.priceRub === "number"
      ? format.number(pkg.priceRub, {
          style: "currency",
          currency: "RUB",
          maximumFractionDigits: 0,
        })
      : "—";

  const duration =
    pkg.durationUnit.toLowerCase() === "day"
      ? t("duration.day", { count: pkg.duration })
      : `${pkg.duration} ${pkg.durationUnit.toLowerCase()}${pkg.duration === 1 ? "" : "s"}`;

  const displayName = locale === "ru" && pkg.nameRu ? pkg.nameRu : pkg.name;

  return (
    <Card size="sm" className="hover:bg-muted/40 transition-colors">
      <CardHeader>
        <CardTitle>{displayName}</CardTitle>
        <CardAction>
          <span className="text-foreground text-sm font-medium" lang={locale}>
            {price}
          </span>
        </CardAction>
        <CardDescription>
          {formatVolume(pkg.volume)} · {duration}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

function NoMatches() {
  const t = useTranslations("Catalog");
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("noMatchingPlans")}</CardTitle>
        <CardDescription>{t("noMatchingDescription")}</CardDescription>
      </CardHeader>
    </Card>
  );
}

type ExpandableGroup = {
  id: string;
  title: ReactNode;
  packages: CatalogPackage[];
};

function ExpandableGroupsPanel({ groups }: { groups: ExpandableGroup[] }) {
  const t = useTranslations("Catalog");
  const format = useFormatter();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Drop expansion if the open group falls out of the filtered list.
  const visibleExpanded =
    expandedId !== null && groups.some((group) => group.id === expandedId)
      ? expandedId
      : null;

  if (groups.length === 0) {
    return <NoMatches />;
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const expanded = visibleExpanded === group.id;
        const fromPrice = lowestPriceRub(group.packages);
        const toggle = () =>
          setExpandedId((current) => (current === group.id ? null : group.id));

        return (
          <div key={group.id} className="space-y-3">
            <Card
              size="sm"
              role="button"
              tabIndex={0}
              aria-expanded={expanded}
              className="hover:bg-muted/40 cursor-pointer transition-colors"
              onClick={toggle}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggle();
                }
              }}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {group.title}
                </CardTitle>
                <CardAction>
                  <span className="text-foreground text-sm font-medium">
                    {fromPrice === undefined
                      ? "—"
                      : t("fromPrice", {
                          price: format.number(fromPrice, {
                            style: "currency",
                            currency: "RUB",
                            maximumFractionDigits: 0,
                          }),
                        })}
                  </span>
                </CardAction>
              </CardHeader>
            </Card>

            {expanded ? (
              <div className="space-y-3 pl-1">
                {group.packages.map((pkg) => (
                  <PackageCard key={pkg.packageCode} pkg={pkg} />
                ))}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function CountryGroupsPanel({ groups }: { groups: PopularCountryPackages[] }) {
  const expandable = useMemo(
    () =>
      groups
        .filter((group) => group.packages.length > 0)
        .map((group) => ({
          id: group.countryCode,
          title: (
            <>
              <ReactCountryFlag
                countryCode={group.countryCode}
                svg
                style={{ width: "1.25em", height: "1.25em" }}
                aria-label={group.countryName}
              />
              <span>{group.countryName}</span>
            </>
          ),
          packages: group.packages,
        })),
    [groups],
  );

  return <ExpandableGroupsPanel groups={expandable} />;
}

function RegionGroupsPanel({ groups }: { groups: RegionPackages[] }) {
  const locale = useLocale();

  const expandable = useMemo(
    () =>
      groups
        .map((group) => ({
          id: group.regionLabel,
          label:
            locale === "ru" && group.regionLabelRu
              ? group.regionLabelRu
              : group.regionLabel,
          packages: group.packages,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, locale))
        .map(({ id, label, packages }) => ({
          id,
          title: <span>{label}</span>,
          packages,
        })),
    [groups, locale],
  );

  return <ExpandableGroupsPanel groups={expandable} />;
}

function GlobalPanel({ packages }: { packages: CatalogPackage[] }) {
  if (packages.length === 0) {
    return <NoMatches />;
  }

  return (
    <div className="space-y-3">
      {packages.map((pkg) => (
        <PackageCard key={pkg.packageCode} pkg={pkg} />
      ))}
    </div>
  );
}

export function PackageCatalog({
  popular,
  local,
  regional,
  global,
}: {
  popular: PopularCountryPackages[];
  local: PopularCountryPackages[];
  regional: RegionPackages[];
  global: CatalogPackage[];
}) {
  const t = useTranslations("Catalog");
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("popular");

  const trimmed = query.trim().toLowerCase();

  const popularGroups = useMemo(
    () => filterCountryGroups(popular, trimmed),
    [popular, trimmed],
  );
  const localGroups = useMemo(
    () => filterCountryGroups(local, trimmed),
    [local, trimmed],
  );
  const regionalGroups = useMemo(
    () => filterRegionGroups(regional, trimmed),
    [regional, trimmed],
  );
  const globalPackages = useMemo(
    () =>
      trimmed ? global.filter((pkg) => packageMatches(pkg, trimmed)) : global,
    [global, trimmed],
  );

  return (
    <div className="flex min-h-full flex-col gap-4">
      <div className="border-border sticky top-0 z-30 -mx-4 space-y-3 border-b bg-white/95 px-4 pt-1 pb-3 backdrop-blur supports-backdrop-filter:bg-white/80">
        <label htmlFor="catalog-search" className="sr-only">
          {t("searchLabel")}
        </label>
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            id="catalog-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("searchPlaceholder")}
            autoComplete="off"
            enterKeyHint="search"
            className="h-11 pl-9"
          />
        </div>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (typeof value === "string") setTab(value);
        }}
        className="gap-4"
      >
        <TabsList className="grid h-11 w-full grid-cols-4">
          {tabValues.map((value) => (
            <TabsTrigger
              key={value}
              value={value}
              className="text-xs sm:text-sm"
            >
              {t(`tabs.${value}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="popular" className="space-y-3">
          <CountryGroupsPanel groups={popularGroups} />
        </TabsContent>

        <TabsContent value="local" className="space-y-3">
          <CountryGroupsPanel groups={localGroups} />
        </TabsContent>

        <TabsContent value="regional" className="space-y-3">
          <RegionGroupsPanel groups={regionalGroups} />
        </TabsContent>

        <TabsContent value="global" className="space-y-3">
          <GlobalPanel packages={globalPackages} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
