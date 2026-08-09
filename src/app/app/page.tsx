"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

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

const catalog: Record<string, PlanStub[]> = {
  popular: [
    {
      id: "tr",
      name: "Turkey",
      description: "Popular · 5–20 GB plans",
      price: "from $4",
    },
    {
      id: "us",
      name: "United States",
      description: "Popular · nationwide coverage",
      price: "from $6",
    },
    {
      id: "jp",
      name: "Japan",
      description: "Popular · tourist bundles",
      price: "from $5",
    },
  ],
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

function filterPlans(plans: PlanStub[], query: string) {
  if (!query) return plans;
  return plans.filter(
    (plan) =>
      plan.name.toLowerCase().includes(query) ||
      plan.description.toLowerCase().includes(query),
  );
}

export default function AppHome() {
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("popular");

  const trimmed = query.trim().toLowerCase();

  const panels = useMemo(
    () =>
      tabs.map((item) => ({
        ...item,
        plans: filterPlans(catalog[item.value] ?? [], trimmed),
      })),
    [trimmed],
  );

  return (
    <div className="flex min-h-full flex-col gap-4">
      <div className="sticky top-0 z-30 -mx-4 space-y-3 border-b border-border bg-white/95 px-4 pb-3 pt-1 backdrop-blur supports-backdrop-filter:bg-white/80">
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

        {panels.map((item) => (
          <TabsContent key={item.value} value={item.value} className="space-y-3">
            {item.plans.length === 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>No matching plans</CardTitle>
                  <CardDescription>
                    Try another search once the full catalog is wired up.
                  </CardDescription>
                </CardHeader>
              </Card>
            ) : (
              item.plans.map((plan) => (
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
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
