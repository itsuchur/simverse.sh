"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
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
} from "~/server/suppliers/esimaccess/catalog-types";

const tabs = [
  { value: "popular", label: "Popular" },
  { value: "local", label: "Local" },
  { value: "regional", label: "Regional" },
  { value: "global", label: "Global" },
] as const;

type PlanStub = {
  id: string;
  name: string;
  description: string;
  price: string;
};

const stubCatalog: Record<"local" | "regional" | "global", PlanStub[]> = {
  local: [
    {
      id: "near-1",
      name: "Nearby country A",
      description: "Based on your Telegram locale",
      price: "—",
    },
    {
      id: "near-2",
      name: "Nearby country B",
      description: "Local single-country eSIM",
      price: "—",
    },
  ],
  regional: [
    {
      id: "eu",
      name: "Europe",
      description: "30+ countries · regional pass",
      price: "from $12",
    },
    {
      id: "asia",
      name: "Asia",
      description: "Multi-country travel packs",
      price: "from $14",
    },
  ],
  global: [
    {
      id: "world",
      name: "Global Pass",
      description: "100+ countries on one eSIM",
      price: "from $29",
    },
  ],
};

function formatVolume(bytes: number) {
  const gib = bytes / 1024 ** 3;
  if (gib >= 1) {
    return Number.isInteger(gib) ? `${gib} GB` : `${gib.toFixed(1)} GB`;
  }
  const mib = bytes / 1024 ** 2;
  return `${Math.round(mib)} MB`;
}

function formatDuration(duration: number, unit: string) {
  const label = unit.toLowerCase() === "day" ? "day" : unit.toLowerCase();
  return `${duration} ${label}${duration === 1 ? "" : "s"}`;
}

function formatPriceRub(priceRub: number | undefined) {
  if (typeof priceRub !== "number") {
    return "—";
  }
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(priceRub);
}

function filterStubPlans(plans: PlanStub[], query: string) {
  if (!query) return plans;
  return plans.filter(
    (plan) =>
      plan.name.toLowerCase().includes(query) ||
      plan.description.toLowerCase().includes(query),
  );
}

function filterPopularGroups(
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
        packages: group.packages.filter((pkg) =>
          pkg.name.toLowerCase().includes(query),
        ),
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
  return (
    <Card size="sm" className="transition-colors hover:bg-muted/40">
      <CardHeader>
        <CardTitle>{pkg.name}</CardTitle>
        <CardAction>
          <span className="text-sm font-medium text-foreground">
            {formatPriceRub(pkg.priceRub)}
          </span>
        </CardAction>
        <CardDescription>
          {formatVolume(pkg.volume)} ·{" "}
          {formatDuration(pkg.duration, pkg.durationUnit)}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

function PopularPanel({
  groups,
}: {
  groups: PopularCountryPackages[];
}) {
  const [expandedCountry, setExpandedCountry] = useState<string | null>(null);

  // Drop expansion if the open country falls out of the filtered list.
  const visibleExpanded =
    expandedCountry !== null &&
    groups.some((group) => group.countryCode === expandedCountry)
      ? expandedCountry
      : null;

  if (groups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No matching plans</CardTitle>
          <CardDescription>
            Try another search or check popular countries in Redis.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const expanded = visibleExpanded === group.countryCode;
        const fromPrice = lowestPriceRub(group.packages);

        return (
          <div key={group.countryCode} className="space-y-3">
            <Card
              size="sm"
              role="button"
              tabIndex={0}
              aria-expanded={expanded}
              className="cursor-pointer transition-colors hover:bg-muted/40"
              onClick={() =>
                setExpandedCountry((current) =>
                  current === group.countryCode ? null : group.countryCode,
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setExpandedCountry((current) =>
                    current === group.countryCode ? null : group.countryCode,
                  );
                }
              }}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ReactCountryFlag
                    countryCode={group.countryCode}
                    svg
                    style={{ width: "1.25em", height: "1.25em" }}
                    aria-label={group.countryName}
                  />
                  <span>{group.countryName}</span>
                </CardTitle>
                <CardAction>
                  <span className="text-sm font-medium text-foreground">
                    {fromPrice === undefined
                      ? "—"
                      : `from ${formatPriceRub(fromPrice)}`}
                  </span>
                </CardAction>
              </CardHeader>
            </Card>

            {expanded ? (
              group.packages.length === 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>No packages</CardTitle>
                    <CardDescription>
                      Nothing available for {group.countryName} yet.
                    </CardDescription>
                  </CardHeader>
                </Card>
              ) : (
                <div className="space-y-3 pl-1">
                  {group.packages.map((pkg) => (
                    <PackageCard key={pkg.packageCode} pkg={pkg} />
                  ))}
                </div>
              )
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function StubPanel({ plans }: { plans: PlanStub[] }) {
  if (plans.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No matching plans</CardTitle>
          <CardDescription>
            Try another search once the full catalog is wired up.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      {plans.map((plan) => (
        <Card
          key={plan.id}
          size="sm"
          className="cursor-pointer transition-colors hover:bg-muted/40"
        >
          <CardHeader>
            <CardTitle>{plan.name}</CardTitle>
            <CardAction>
              <span className="text-sm font-medium text-foreground">
                {plan.price}
              </span>
            </CardAction>
            <CardDescription>{plan.description}</CardDescription>
          </CardHeader>
        </Card>
      ))}
    </>
  );
}

export function PackageCatalog({
  popular,
}: {
  popular: PopularCountryPackages[];
}) {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("popular");

  const trimmed = query.trim().toLowerCase();

  const popularGroups = useMemo(
    () => filterPopularGroups(popular, trimmed),
    [popular, trimmed],
  );

  const stubPanels = useMemo(
    () =>
      (["local", "regional", "global"] as const).map((value) => ({
        value,
        plans: filterStubPlans(stubCatalog[value], trimmed),
      })),
    [trimmed],
  );

  return (
    <div className="flex min-h-full flex-col gap-4">
      <div className="sticky top-0 z-30 -mx-4 space-y-3 border-b border-border bg-white/95 px-4 pt-1 pb-3 backdrop-blur supports-backdrop-filter:bg-white/80">
        <label htmlFor="catalog-search" className="sr-only">
          Search destinations
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="catalog-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search countries or regions"
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
          {tabs.map((item) => (
            <TabsTrigger
              key={item.value}
              value={item.value}
              className="text-xs sm:text-sm"
            >
              {item.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="popular" className="space-y-3">
          <PopularPanel groups={popularGroups} />
        </TabsContent>

        {stubPanels.map((item) => (
          <TabsContent
            key={item.value}
            value={item.value}
            className="space-y-3"
          >
            <StubPanel plans={item.plans} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
