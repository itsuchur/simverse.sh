"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Globe, Search } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import OrderConfirmation from "~/components/ui/orderConfirmation";
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

function uniqueOperators(packages: CatalogPackage[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const pkg of packages) {
    for (const network of pkg.networks ?? []) {
      if (seen.has(network.operatorName)) continue;
      seen.add(network.operatorName);
      names.push(network.operatorName);
    }
  }
  return names;
}

function groupPackagesByDuration(packages: CatalogPackage[]) {
  const byDuration = new Map<number, CatalogPackage[]>();

  for (const pkg of packages) {
    const list = byDuration.get(pkg.duration) ?? [];
    list.push(pkg);
    byDuration.set(pkg.duration, list);
  }

  return [...byDuration.entries()]
    .sort(([a], [b]) => a - b)
    .map(([duration, pkgs]) => ({
      duration,
      packages: [...pkgs].sort((a, b) => a.volume - b.volume),
    }));
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

type DestinationGroup = {
  id: string;
  label: string;
  title: ReactNode;
  packages: CatalogPackage[];
};

function DestinationDialog({
  group,
  onSelectPlan,
}: {
  group: DestinationGroup;
  onSelectPlan: (pkg: CatalogPackage, destinationLabel: string) => void;
}) {
  const t = useTranslations("Catalog");
  const format = useFormatter();
  const [open, setOpen] = useState(false);
  const operators = uniqueOperators(group.packages);
  const durationGroups = groupPackagesByDuration(group.packages);
  const fromPrice = lowestPriceRub(group.packages);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Card
            size="sm"
            className="hover:bg-muted/40 w-full cursor-pointer transition-colors"
          />
        }
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
      </DialogTrigger>

      <DialogContent className="max-h-[min(85vh,36rem)] gap-3 overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {group.title}
          </DialogTitle>
        </DialogHeader>

        <hr className="border-border" />

        {operators.length > 0 ? (
          operators.length > 3 ? (
            <p className="text-muted-foreground text-sm">
              {t("countriesAndNetworks", {
                count: String(operators.length),
              })}
            </p>
          ) : (
            <ul className="text-muted-foreground list-inside list-disc text-sm">
              {operators.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          )
        ) : null}

        <p className="font-medium">{t("choosePackage")}</p>

        <div className="space-y-4">
          {durationGroups.map(({ duration, packages }) => (
            <div key={duration} className="space-y-1">
              <h1 className="text-base font-semibold">
                {t("duration.day", { count: duration })}
              </h1>
              <div className="space-y-0.5">
                {packages.map((pkg) => {
                  const price =
                    typeof pkg.priceRub === "number"
                      ? format.number(pkg.priceRub, {
                          style: "currency",
                          currency: "RUB",
                          maximumFractionDigits: 0,
                        })
                      : "—";

                  return (
                    <button
                      key={pkg.packageCode}
                      type="button"
                      className="hover:bg-muted/60 flex w-full items-center justify-between rounded-md px-1 py-1.5 text-left text-sm transition-colors"
                      onClick={() => {
                        setOpen(false);
                        onSelectPlan(pkg, group.label);
                      }}
                    >
                      <span>{formatVolume(pkg.volume)}</span>
                      <span className="font-medium">{price}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DestinationGroupsPanel({
  groups,
  onSelectPlan,
}: {
  groups: DestinationGroup[];
  onSelectPlan: (pkg: CatalogPackage, destinationLabel: string) => void;
}) {
  if (groups.length === 0) {
    return <NoMatches />;
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <DestinationDialog
          key={group.id}
          group={group}
          onSelectPlan={onSelectPlan}
        />
      ))}
    </div>
  );
}

function CountryGroupsPanel({
  groups,
  onSelectPlan,
}: {
  groups: PopularCountryPackages[];
  onSelectPlan: (pkg: CatalogPackage, destinationLabel: string) => void;
}) {
  const destinations = useMemo(
    () =>
      groups
        .filter((group) => group.packages.length > 0)
        .map((group) => ({
          id: group.countryCode,
          label: group.countryName,
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

  return (
    <DestinationGroupsPanel groups={destinations} onSelectPlan={onSelectPlan} />
  );
}

function RegionGroupsPanel({
  groups,
  onSelectPlan,
}: {
  groups: RegionPackages[];
  onSelectPlan: (pkg: CatalogPackage, destinationLabel: string) => void;
}) {
  const locale = useLocale();

  const destinations = useMemo(
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
          label,
          title: <span>{label}</span>,
          packages,
        })),
    [groups, locale],
  );

  return (
    <DestinationGroupsPanel groups={destinations} onSelectPlan={onSelectPlan} />
  );
}

function GlobalPanel({
  packages,
  onSelectPlan,
}: {
  packages: CatalogPackage[];
  onSelectPlan: (pkg: CatalogPackage, destinationLabel: string) => void;
}) {
  const t = useTranslations("Catalog");

  if (packages.length === 0) {
    return <NoMatches />;
  }

  const label = t("tabs.global");

  return (
    <DestinationGroupsPanel
      groups={[
        {
          id: "global",
          label,
          title: (
            <>
              <Globe className="size-5" aria-hidden />
              <span>{label}</span>
            </>
          ),
          packages,
        },
      ]}
      onSelectPlan={onSelectPlan}
    />
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
  const [selectedPkg, setSelectedPkg] = useState<CatalogPackage | null>(null);
  const [destinationLabel, setDestinationLabel] = useState<string | undefined>();
  const [orderOpen, setOrderOpen] = useState(false);

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

  const onSelectPlan = (pkg: CatalogPackage, label: string) => {
    setSelectedPkg(pkg);
    setDestinationLabel(label);
    setOrderOpen(true);
  };

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
          <CountryGroupsPanel
            groups={popularGroups}
            onSelectPlan={onSelectPlan}
          />
        </TabsContent>

        <TabsContent value="local" className="space-y-3">
          <CountryGroupsPanel
            groups={localGroups}
            onSelectPlan={onSelectPlan}
          />
        </TabsContent>

        <TabsContent value="regional" className="space-y-3">
          <RegionGroupsPanel
            groups={regionalGroups}
            onSelectPlan={onSelectPlan}
          />
        </TabsContent>

        <TabsContent value="global" className="space-y-3">
          <GlobalPanel packages={globalPackages} onSelectPlan={onSelectPlan} />
        </TabsContent>
      </Tabs>

      <OrderConfirmation
        open={orderOpen}
        onOpenChange={setOrderOpen}
        pkg={selectedPkg}
        destinationLabel={destinationLabel}
      />
    </div>
  );
}
