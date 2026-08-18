/**
 * Integration test for the RedisJSON/RediSearch catalog store and cart.
 *
 * WARNING: flushes the target database. Point REDIS_URL at a scratch Redis 8
 * instance (JSON + Search modules loaded) and run:
 *
 *   REDIS_URL=redis://:pass@127.0.0.1:6379 SKIP_ENV_VALIDATION=1 \
 *     bun --conditions=react-server scripts/catalog-store-test.ts
 */

import { getRedis } from "~/server/redis";
import {
  getCachedEsimAccessPackages,
  getCatalogByScope,
  getEsimAccessPackageByCode,
  getPopularPackagesByCountry,
  searchEsimAccessPackageCodes,
  writeEsimAccessCatalog,
  POPULAR_COUNTRIES_REDIS_KEY,
  type EsimAccessPackage,
} from "~/server/suppliers/esimaccess/packages";
import {
  cartPlanForPackageCode,
  replaceCartPlan,
  getCartPlan,
} from "~/server/cart";

const GB = 1024 ** 3;

function pkg(over: Partial<EsimAccessPackage>): EsimAccessPackage {
  return {
    packageCode: "CK0000",
    slug: "slug",
    name: "Placeholder 1GB 30Days",
    price: 10_000,
    retailPrice: 20_000,
    priceRub: 200,
    priceStars: 120,
    currencyCode: "USD",
    volume: 1 * GB,
    duration: 30,
    durationUnit: "DAY",
    location: "XX",
    locationNetworkList: [
      { operatorList: [{ operatorName: "TestNet", networkType: "5G" }] },
    ],
    ...over,
  };
}

const manyCodes = Array.from(
  { length: 95 },
  (_, i) =>
    `${String.fromCharCode(65 + Math.floor(i / 26))}${String.fromCharCode(65 + (i % 26))}`,
).join(",");

const CATALOG: EsimAccessPackage[] = [
  pkg({
    packageCode: "ES3",
    slug: "es-3gb",
    name: "Spain 3GB 30Days",
    nameRu: "Испания — 3 ГБ, 30 дней",
    location: "ES",
    volume: 3 * GB,
    priceRub: 500,
  }),
  pkg({
    packageCode: "ES5",
    slug: "es-5gb",
    name: "Spain 5GB 30Days",
    nameRu: "Испания — 5 ГБ, 30 дней",
    location: "ES",
    volume: 5 * GB,
    priceRub: 700,
  }),
  pkg({
    packageCode: "FR3",
    slug: "fr-3gb",
    name: "France 3GB 30Days",
    nameRu: "Франция — 3 ГБ, 30 дней",
    location: "FR",
    volume: 3 * GB,
  }),
  pkg({
    packageCode: "EU10",
    slug: "eu-10gb",
    name: "Europe(35 areas) 10GB 30Days",
    nameRu: "Европа (35 направлений) — 10 ГБ, 30 дней",
    location: "FR,DE,IT,ES,PT",
    volume: 10 * GB,
  }),
  pkg({
    packageCode: "GL20",
    slug: "gl-20gb",
    name: "Global139 20GB 30Days",
    nameRu: "Весь мир — 20 ГБ, 30 дней",
    location: manyCodes,
    volume: 20 * GB,
  }),
];

let failures = 0;

function check(label: string, ok: boolean, extra?: unknown) {
  if (ok) {
    console.log(`  PASS ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}`, extra ?? "");
  }
}

async function codes(query: string) {
  const result = await searchEsimAccessPackageCodes(query);
  return result === null ? null : [...result].sort();
}

async function main() {
  const redis = await getRedis();
  await redis.flushDb();

  console.log("== write generation 1 ==");
  const gen1 = await writeEsimAccessCatalog(
    {
      syncedAt: new Date().toISOString(),
      count: CATALOG.length,
      usdRubRate: 80,
      usdRubRateDate: "2026-08-18",
    },
    CATALOG,
  );
  console.log(`  generation ${gen1}`);

  console.log("== read back ==");
  const cached = await getCachedEsimAccessPackages();
  check("meta present", cached !== null);
  check("count", cached?.count === 5, cached?.count);
  check("packageList length", cached?.packageList.length === 5);
  check("usdRubRate", cached?.usdRubRate === 80);

  const byCode = await getEsimAccessPackageByCode("ES3");
  check("lookup by code", byCode?.pkg.name === "Spain 3GB 30Days");
  check("lookup meta rate", byCode?.meta.usdRubRate === 80);
  check(
    "lookup missing code",
    (await getEsimAccessPackageByCode("NOPE")) === null,
  );

  console.log("== search (RediSearch) ==");
  check("english name", (await codes("spain"))?.join() === "ES3,ES5");
  check("english infix", (await codes("pain"))?.join() === "ES3,ES5");
  check("russian country", (await codes("Испания"))?.join() === "ES3,ES5");
  check("russian infix", (await codes("спани"))?.join() === "ES3,ES5");
  check(
    "region infix",
    (await codes("urop"))?.includes("EU10") ?? false,
    await codes("urop"),
  );
  check("russian region", (await codes("Европа"))?.includes("EU10") ?? false);
  check(
    "iso code",
    (await codes("FR"))?.includes("FR3") ?? false,
    await codes("FR"),
  );
  check(
    "multi token AND",
    (await codes("france 3gb"))?.join() === "FR3",
    await codes("france 3gb"),
  );
  check("no match", (await codes("xyzzy"))?.length === 0);
  check("blank query is null", (await codes("  !!  ")) === null);
  const single = await codes("s");
  check("single char does not throw", Array.isArray(single), single);

  console.log("== grouping (unchanged read logic) ==");
  const scope = await getCatalogByScope("en");
  // Sorted by English country name: France before Spain.
  check(
    "local groups",
    scope.local.map((g) => g.countryCode).join() === "FR,ES",
    scope.local.map((g) => g.countryCode),
  );
  check(
    "regional group",
    scope.regional[0]?.regionLabel === "Europe(35 areas)",
  );
  check("global bucket", scope.global[0]?.packageCode === "GL20");

  await redis.del(POPULAR_COUNTRIES_REDIS_KEY);
  await redis.rPush(POPULAR_COUNTRIES_REDIS_KEY, ["ES"]);
  const popular = await getPopularPackagesByCountry("en");
  check("popular tab", popular[0]?.packages.length === 2, popular[0]);

  console.log("== cart on RedisJSON ==");
  const plan = await cartPlanForPackageCode("ES3");
  check(
    "cart plan from code",
    plan.price_rub === 500 && plan.name === "Spain 3GB 30Days",
  );
  await replaceCartPlan("42", plan);
  check("cart key type", (await redis.type("cart:42")) === "ReJSON-RL");
  check("cart ttl set", (await redis.ttl("cart:42")) > 86_000);
  const roundTrip = await getCartPlan("42");
  check("cart round trip", JSON.stringify(roundTrip) === JSON.stringify(plan));
  check("cart missing user", (await getCartPlan("777")) === null);

  console.log("== generation flip + prune ==");
  const gen2 = await writeEsimAccessCatalog(
    {
      syncedAt: new Date().toISOString(),
      count: 4,
      usdRubRate: 81,
      usdRubRateDate: "2026-08-18",
    },
    CATALOG.slice(0, 4),
  );
  check("new generation", gen2 !== gen1);
  const cached2 = await getCachedEsimAccessPackages();
  check("new count", cached2?.count === 4 && cached2.packageList.length === 4);
  check(
    "dropped package gone",
    (await getEsimAccessPackageByCode("GL20")) === null,
  );

  let pkgKeys = 0;
  let metaKeys = 0;
  for await (const keys of redis.scanIterator({
    MATCH: "catalog:*",
    COUNT: 500,
  })) {
    for (const key of keys) {
      if (key.startsWith("catalog:package:")) pkgKeys += 1;
      if (key.startsWith("catalog:meta:")) metaKeys += 1;
    }
  }
  check("old package docs pruned", pkgKeys === 4, pkgKeys);
  check("old meta pruned", metaKeys === 1, metaKeys);
  check("search excludes old gen", (await codes("global"))?.length === 0);

  console.log(failures === 0 ? "\nALL TESTS PASSED" : `\n${failures} FAILURES`);
  process.exit(failures === 0 ? 0 : 1);
}

await main();
