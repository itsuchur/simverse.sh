"use client";

import { useState } from "react";

import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  Bar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Link } from "~/i18n/navigation";
import { cn } from "~/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import type { SalesPoint, SalesRange } from "~/server/dashboard/sales-series";
import { SALES_RANGES } from "~/server/dashboard/sales-series";

const RANGE_LABELS: Record<SalesRange, string> = {
  week: "Week",
  month: "Month",
  year: "Year",
};

function salesHref(range: SalesRange) {
  if (range === "month") {
    return "/dashboard";
  }
  return `/dashboard?range=${range}`;
}

function formatMoney(value: number, currency: "USD" | "RUB") {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function SalesGraph({
  range,
  series,
}: {
  range: SalesRange;
  series: SalesPoint[];
}) {
  const [currency, setCurrency] = useState<"USD" | "RUB">("USD");
  const revenueKey = currency === "USD" ? "revenueUsd" : "revenueRub";
  const totalUsd = series.reduce((sum, point) => sum + point.revenueUsd, 0);
  const totalRub = series.reduce((sum, point) => sum + point.revenueRub, 0);
  const totalOrders = series.reduce((sum, point) => sum + point.orderCount, 0);

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <CardDescription>Sales</CardDescription>
            <CardTitle className="text-lg">Revenue and orders</CardTitle>
          </div>
          <nav
            aria-label="Sales timeline"
            className="bg-muted inline-flex rounded-lg p-1"
          >
            {SALES_RANGES.map((value) => {
              const active = value === range;
              return (
                <Link
                  key={value}
                  href={salesHref(value)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium",
                    active
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {RANGE_LABELS[value]}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            Net revenue{" "}
            <span className="text-foreground font-medium tabular-nums">
              {formatMoney(totalUsd, "USD")} + {formatMoney(totalRub, "RUB")}
            </span>
          </span>
          <span>
            Paid orders{" "}
            <span className="text-foreground font-medium tabular-nums">
              {totalOrders}
            </span>
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <p className="text-muted-foreground mb-3 text-xs">
          {range === "year"
            ? "Last 12 calendar months"
            : range === "week"
              ? "Last 7 days"
              : "Last 30 days"}
          , UTC, through now. Net revenue subtracts refunds and chargebacks from
          the original payment period. Paid orders include refunded orders and
          top-ups. USD includes Stars at $0.03 per Star.
        </p>
        <div
          className="mb-3 flex gap-2"
          role="group"
          aria-label="Revenue currency"
        >
          {(["USD", "RUB"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={currency === value}
              onClick={() => setCurrency(value)}
              className={cn(
                "rounded-md px-3 py-1 text-sm",
                currency === value
                  ? "bg-muted font-medium"
                  : "text-muted-foreground",
              )}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="h-56 w-full min-w-0 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={series}
              margin={{ top: 8, right: 4, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                minTickGap={24}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                yAxisId="revenue"
                tickLine={false}
                axisLine={false}
                width={48}
                tick={{ fontSize: 11 }}
                tickFormatter={(value: number) => formatMoney(value, currency)}
              />
              <YAxis
                yAxisId="orders"
                orientation="right"
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                width={32}
                tick={{ fontSize: 11 }}
              />
              <Tooltip
                formatter={(value, name) => {
                  const numeric =
                    typeof value === "number" ? value : Number(value);
                  if (name === `Net revenue (${currency})`) {
                    return [
                      formatMoney(numeric, currency),
                      `Net revenue (${currency})`,
                    ];
                  }
                  return [numeric, "Orders"];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                yAxisId="orders"
                dataKey="orderCount"
                name="Orders"
                fill="var(--chart-2)"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
              />
              <Line
                yAxisId="revenue"
                type="monotone"
                dataKey={revenueKey}
                name={`Net revenue (${currency})`}
                stroke="var(--chart-1)"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
