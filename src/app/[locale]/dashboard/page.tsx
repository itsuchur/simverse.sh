import { isSalesActive } from "~/server/sales";
import {
  getCatalogByScope,
  getPopularCountryCodes,
} from "~/server/suppliers/esimaccess/packages";

import { PopularCountriesEditor } from "./_components/popular-countries-editor";
import { StartSalesSwitch } from "./_components/start-sales-switch";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const [salesActive, popularCodes, catalog] = await Promise.all([
    isSalesActive(),
    getPopularCountryCodes(),
    getCatalogByScope("en"),
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
      <StartSalesSwitch initialActive={salesActive} />
      <PopularCountriesEditor
        initialCountries={initialCountries}
        availableCountries={availableCountries}
      />
    </main>
  );
}
