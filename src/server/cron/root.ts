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
import {
  getEsimflyClient,
  isEsimflyConfigured,
} from "~/server/suppliers/esimfly/client";
import { withRussianNames as withEsimflyRussianNames } from "~/server/suppliers/esimfly/localize";
import {
  ESIMFLY_SUPPLIER,
  fetchEsimflyPackages,
  normalizeEsimflyPackages,
  writeEsimflyCatalog,
} from "~/server/suppliers/esimfly/packages";

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

async function syncEsimflyPackages() {
  if (!isEsimflyConfigured()) {
    console.warn(
      "[cron] ESIMFLY_ACCESS_CODE / ESIMFLY_SECRET_KEY not set; skipping eSIMfly package sync",
    );
    return;
  }

  const [raw, excludedCodes] = await Promise.all([
    fetchEsimflyPackages(getEsimflyClient()),
    getExcludedPackageCodes(ESIMFLY_SUPPLIER),
  ]);
  const { packages, skipped, unresolvedNames } = normalizeEsimflyPackages(raw);
  if (unresolvedNames.length > 0) {
    console.warn(
      `[cron] eSIMfly: ${skipped.length} packages skipped; unresolved location names: ${unresolvedNames.join(", ")}`,
    );
  }
  const included = filterExcludedPackages(packages, excludedCodes);
  const packageList = await withEsimflyRussianNames(included);

  const generation = await writeEsimflyCatalog(
    {
      syncedAt: new Date().toISOString(),
      count: packageList.length,
      currency: packageList[0]?.currency ?? raw[0]?.currency ?? "USD",
    },
    packageList,
  );

  console.log(
    `[cron] synced ${packageList.length} of ${raw.length} eSIMfly packages to RedisJSON catalog generation ${generation} (${excludedCodes.size} excluded, ${skipped.length} without resolvable location)`,
  );
}

async function runSync() {
  // Suppliers sync independently so one failing catalog never blocks the other.
  await Promise.all([
    syncEsimAccessPackages().catch((error) => {
      console.error("[cron] eSIM Access package sync failed", error);
    }),
    syncEsimflyPackages().catch((error) => {
      console.error("[cron] eSIMfly package sync failed", error);
    }),
  ]);
}

// Daily catalog sync at midnight (server local time); protect prevents overlapping runs.
new Cron("0 0 * * *", { protect: true }, () => {
  void runSync();
});

void runSync();

console.log(
  "[cron] eSIM Access and eSIMfly package sync scheduled daily at midnight",
);

async function recoverOrders() {
  try {
    await recoverPendingOrders();
  } catch (error) {
    console.error("[cron] order recovery failed", error);
  }
}
new Cron("* * * * *", { protect: true }, recoverOrders);
void recoverOrders();
