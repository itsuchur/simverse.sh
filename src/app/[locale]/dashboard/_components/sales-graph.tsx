"use client";

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

function formatUsd(value: number) {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
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
  const totalRevenue = series.reduce((sum, point) => sum + point.revenueUsd, 0);
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
            Revenue{" "}
            <span className="text-foreground font-medium tabular-nums">
              {formatUsd(Math.round(totalRevenue * 100) / 100)}
            </span>
          </span>
          <span>
            Orders{" "}
            <span className="text-foreground font-medium tabular-nums">
              {totalOrders}
            </span>
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
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
                tickFormatter={(value: number) => formatUsd(value)}
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
                  if (name === "Revenue") {
                    return [formatUsd(numeric), "Revenue"];
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
                dataKey="revenueUsd"
                name="Revenue"
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
