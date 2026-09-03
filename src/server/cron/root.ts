import { Cron } from "croner";

import { withRussianNames } from "~/server/suppliers/esimaccess/localize";
import {
  fetchEsimAccessPackages,
  fetchUsdRubRate,
  withPriceRub,
  writeEsimAccessCatalog,
} from "~/server/suppliers/esimaccess/packages";
import { preferCatalogPackages } from "~/server/suppliers/esimaccess/prefer-packages";

async function syncEsimAccessPackages() {
  const [packages, fx] = await Promise.all([
    fetchEsimAccessPackages(),
    fetchUsdRubRate(),
  ]);
  const preferred = preferCatalogPackages(packages);
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
    `[cron] synced ${packageList.length} of ${packages.length} eSIM Access packages to RedisJSON catalog generation ${generation} (USD/RUB ${fx.rate})`,
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
