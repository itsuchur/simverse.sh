import { Cron } from "croner";

import { getRedis } from "~/server/redis";
import { withRussianNames } from "~/server/suppliers/esimaccess/localize";
import {
  ESIMACCESS_PACKAGES_REDIS_KEY,
  fetchEsimAccessPackages,
  fetchUsdRubRate,
  withPriceRub,
} from "~/server/suppliers/esimaccess/packages";
import { preferCatalogPackages } from "~/server/suppliers/esimaccess/prefer-packages";

async function syncEsimAccessPackages() {
  const [packages, fx] = await Promise.all([
    fetchEsimAccessPackages(),
    fetchUsdRubRate(),
  ]);
  const preferred = preferCatalogPackages(packages);
  const packageList = await withRussianNames(withPriceRub(preferred, fx.rate));
  const redis = await getRedis();

  await redis.set(
    ESIMACCESS_PACKAGES_REDIS_KEY,
    JSON.stringify({
      syncedAt: new Date().toISOString(),
      count: packageList.length,
      usdRubRate: fx.rate,
      usdRubRateDate: fx.date,
      packageList,
    }),
  );

  console.log(
    `[cron] synced ${packageList.length} of ${packages.length} eSIM Access packages to Redis key "${ESIMACCESS_PACKAGES_REDIS_KEY}" (USD/RUB ${fx.rate})`,
  );
}

async function runSync() {
  try {
    await syncEsimAccessPackages();
  } catch (error) {
    console.error("[cron] eSIM Access package sync failed", error);
  }
}

// Hourly catalog sync; protect prevents overlapping runs.
new Cron("0 * * * *", { protect: true }, () => {
  void runSync();
});

void runSync();

console.log("[cron] eSIM Access package sync scheduled hourly");
