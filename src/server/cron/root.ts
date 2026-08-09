import { Cron } from "croner";

import { getRedis } from "~/server/redis";
import {
  ESIMACCESS_PACKAGES_REDIS_KEY,
  fetchEsimAccessPackages,
} from "~/server/suppliers/esimaccess/packages";

async function syncEsimAccessPackages() {
  const packages = await fetchEsimAccessPackages();
  const redis = await getRedis();

  await redis.set(
    ESIMACCESS_PACKAGES_REDIS_KEY,
    JSON.stringify({
      syncedAt: new Date().toISOString(),
      count: packages.length,
      packageList: packages,
    }),
  );

  console.log(
    `[cron] synced ${packages.length} eSIM Access packages to Redis key "${ESIMACCESS_PACKAGES_REDIS_KEY}"`,
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
