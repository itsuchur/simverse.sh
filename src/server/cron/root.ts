import { recoverPendingOrders } from "~/server/orders/fulfill";
import { Cron } from "croner";

import {
  filterExcludedPackages,
  getExcludedPackageCodes,
} from "~/server/catalog/package-exclusions";
import { withRussianNames } from "~/server/suppliers/esimaccess/localize";
import {
  ESIMACCESS_SUPPLIER,
  fetchEsimAccessPackages,
  fetchUsdRubRate,
  withPriceRub,
  writeEsimAccessCatalog,
} from "~/server/suppliers/esimaccess/packages";
import { preferCatalogPackages } from "~/server/suppliers/esimaccess/prefer-packages";

async function syncEsimAccessPackages() {
  const [packages, fx, excludedCodes] = await Promise.all([
    fetchEsimAccessPackages(),
    fetchUsdRubRate(),
    getExcludedPackageCodes(ESIMACCESS_SUPPLIER),
  ]);
  const included = filterExcludedPackages(packages, excludedCodes);
  const preferred = preferCatalogPackages(included);
  const packageList = await withRussianNames(withPriceRub(preferred, fx.rate));

  const generation = await writeEsimAccessCatalog(
    {
      syncedAt: new Date().toISOString(),
      count: packageList.length,
      usdRubRate: fx.rate,
      usdRubRateDate: fx.date,
    },
    packageList,
  );

  console.log(
    `[cron] synced ${packageList.length} of ${packages.length} eSIM Access packages to RedisJSON catalog generation ${generation} (${excludedCodes.size} excluded, USD/RUB ${fx.rate})`,
  );
}

async function runSync() {
  try {
    await syncEsimAccessPackages();
  } catch (error) {
    console.error("[cron] eSIM Access package sync failed", error);
  }
}

// Daily catalog sync at midnight (server local time); protect prevents overlapping runs.
new Cron("0 0 * * *", { protect: true }, () => {
  void runSync();
});

void runSync();

console.log("[cron] eSIM Access package sync scheduled daily at midnight");

async function recoverOrders() {
  try {
    await recoverPendingOrders();
  } catch (error) {
    console.error("[cron] order recovery failed", error);
  }
}
new Cron("* * * * *", { protect: true }, recoverOrders);
void recoverOrders();
