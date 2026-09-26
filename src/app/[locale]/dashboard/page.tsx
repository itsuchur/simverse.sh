import { isSalesActive } from "~/server/sales";
import { getEsimAccessBalance } from "~/server/dashboard/esimaccess-balance";
import { getSalesSeries } from "~/server/dashboard/get-sales-series";
import { parseSalesRange } from "~/server/dashboard/sales-series";
import {
  getCatalogByScope,
  getPopularCountryCodes,
} from "~/server/suppliers/esimaccess/packages";

import { EsimAccessBalanceCard } from "./_components/esimaccess-balance-card";
import { PopularCountriesEditor } from "./_components/popular-countries-editor";
import { SalesGraph } from "./_components/sales-graph";
import { StartSalesSwitch } from "./_components/start-sales-switch";

export const dynamic = "force-dynamic";

export default async function DashboardHome({
  searchParams,
}: {
  searchParams: Promise<{
    range?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const range = parseSalesRange(params.range);

  const [salesActive, popularCodes, catalog, balance, series] =
    await Promise.all([
      isSalesActive(),
      getPopularCountryCodes(),
      getCatalogByScope("en"),
      getEsimAccessBalance(),
      getSalesSeries(range),
    ]);

  const availableCountries = catalog.local.map(
    ({ countryCode, countryName }) => ({
      code: countryCode,
      name: countryName,
    }),
  );

  const initialCountries = popularCodes.map((code) => ({
    code,
    name:
      catalog.local.find((group) => group.countryCode === code)?.countryName ??
      code,
  }));

  return (
    <main className="space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <EsimAccessBalanceCard balance={balance} />
      <SalesGraph range={range} series={series} />
      <StartSalesSwitch initialActive={salesActive} />
      <PopularCountriesEditor
        initialCountries={initialCountries}
        availableCountries={availableCountries}
      />
    </main>
  );
}
