import { isSalesActive } from "~/server/sales";

import { StartSalesSwitch } from "./_components/start-sales-switch";

export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const salesActive = await isSalesActive();

  return (
    <main className="space-y-8">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <StartSalesSwitch initialActive={salesActive} />
    </main>
  );
}
