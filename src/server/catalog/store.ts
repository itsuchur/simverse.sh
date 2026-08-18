import "server-only";

import { SCHEMA_FIELD_TYPE, type RedisJSON } from "redis";

import { getRedis } from "~/server/redis";

/**
 * Generation-based RedisJSON catalog store, shared by all suppliers.
 *
 * Each sync writes one JSON document per package under a fresh generation,
 * then flips the supplier's current-generation pointer and prunes older
 * generations. Readers always resolve the pointer first, so a sync that dies
 * halfway leaves the previous catalog fully intact.
 *
 * Keys:
 * - `catalog:package:<supplier>:<generation>:<packageCode>` - RedisJSON doc
 * - `catalog:meta:<supplier>:<generation>`                  - sync metadata
 * - `catalog:current:<supplier>`                            - active generation
 *
 * All package documents are covered by one RediSearch index (`idx:catalog:packages`);
 * queries constrain on the `supplier` and `generation` TAG fields.
 */

export const CATALOG_INDEX = "idx:catalog:packages";
const PACKAGE_KEY_PREFIX = "catalog:package:";

/** Fields every package document must provide for indexing. */
export type CatalogDocumentInput = {
  packageCode: string;
  /** Space-joined haystack: names, country/region labels (EN+RU), ISO codes. */
  searchText: string;
  location: string;
  volume: number;
  duration: number;
  priceRub?: number;
};

type CatalogDocument = CatalogDocumentInput & {
  supplier: string;
  generation: string;
};

function packageKey(supplier: string, generation: string, code: string) {
  return `${PACKAGE_KEY_PREFIX}${supplier}:${generation}:${code}`;
}

function metaKey(supplier: string, generation: string) {
  return `catalog:meta:${supplier}:${generation}`;
}

function currentGenerationKey(supplier: string) {
  return `catalog:current:${supplier}`;
}

async function ensureIndex() {
  const redis = await getRedis();
  try {
    await redis.ft.create(
      CATALOG_INDEX,
      {
        "$.supplier": { type: SCHEMA_FIELD_TYPE.TAG, AS: "supplier" },
        "$.generation": { type: SCHEMA_FIELD_TYPE.TAG, AS: "generation" },
        "$.packageCode": { type: SCHEMA_FIELD_TYPE.TAG, AS: "packageCode" },
        "$.searchText": {
          type: SCHEMA_FIELD_TYPE.TEXT,
          AS: "searchText",
          NOSTEM: true,
        },
        "$.location": {
          type: SCHEMA_FIELD_TYPE.TAG,
          AS: "location",
          SEPARATOR: ",",
        },
        "$.volume": { type: SCHEMA_FIELD_TYPE.NUMERIC, AS: "volume" },
        "$.duration": { type: SCHEMA_FIELD_TYPE.NUMERIC, AS: "duration" },
        "$.priceRub": { type: SCHEMA_FIELD_TYPE.NUMERIC, AS: "priceRub" },
      },
      { ON: "JSON", PREFIX: PACKAGE_KEY_PREFIX },
    );
  } catch (error) {
    if (error instanceof Error && /already exists/i.test(error.message)) {
      return;
    }
    throw error;
  }
}

/** More than any supplier catalog will realistically hold. */
const MAX_RESULTS = 10_000;

function generationFromKey(key: string): string | undefined {
  // catalog:package:<supplier>:<generation>:<code> or catalog:meta:<supplier>:<generation>
  return key.split(":")[3];
}

async function pruneOtherGenerations(supplier: string, keep: string) {
  const redis = await getRedis();
  const patterns = [
    `${PACKAGE_KEY_PREFIX}${supplier}:*`,
    `catalog:meta:${supplier}:*`,
  ];
  for (const pattern of patterns) {
    for await (const keys of redis.scanIterator({
      MATCH: pattern,
      COUNT: 500,
    })) {
      const stale = keys.filter((key) => generationFromKey(key) !== keep);
      if (stale.length > 0) {
        await redis.unlink(stale);
      }
    }
  }
}

/**
 * Writes a full catalog generation and makes it current. Old generations are
 * pruned afterwards, so readers never observe a partially written catalog.
 */
export async function writeCatalogGeneration<Meta extends RedisJSON>(
  supplier: string,
  meta: Meta,
  packages: CatalogDocumentInput[],
) {
  const redis = await getRedis();
  const generation = String(Date.now());

  await ensureIndex();

  const CHUNK = 200;
  for (let i = 0; i < packages.length; i += CHUNK) {
    const multi = redis.multi();
    for (const pkg of packages.slice(i, i + CHUNK)) {
      const doc: CatalogDocument = { ...pkg, supplier, generation };
      multi.json.set(
        packageKey(supplier, generation, pkg.packageCode),
        "$",
        doc,
      );
    }
    await multi.exec();
  }

  await redis.json.set(metaKey(supplier, generation), "$", meta);
  await redis.set(currentGenerationKey(supplier), generation);

  await pruneOtherGenerations(supplier, generation);

  return generation;
}

async function currentGeneration(supplier: string) {
  const redis = await getRedis();
  return redis.get(currentGenerationKey(supplier));
}

export async function readCatalogMeta<Meta>(
  supplier: string,
): Promise<Meta | null> {
  const generation = await currentGeneration(supplier);
  if (!generation) return null;
  const redis = await getRedis();
  return (await redis.json.get(metaKey(supplier, generation))) as Meta | null;
}

function escapeTag(value: string) {
  return value.replace(/([^\p{L}\p{N}])/gu, "\\$1");
}

/** Returns all package documents of the supplier's current generation. */
export async function readCatalogPackages<Doc>(
  supplier: string,
): Promise<Doc[]> {
  const generation = await currentGeneration(supplier);
  if (!generation) return [];
  const redis = await getRedis();
  const reply = await redis.ft.search(
    CATALOG_INDEX,
    `@supplier:{${escapeTag(supplier)}} @generation:{${generation}}`,
    { LIMIT: { from: 0, size: MAX_RESULTS } },
  );
  return reply.documents.map((doc) => doc.value as Doc);
}

/** Direct lookup of one package document in the current generation. */
export async function readCatalogPackage<Doc>(
  supplier: string,
  packageCode: string,
): Promise<Doc | null> {
  const generation = await currentGeneration(supplier);
  if (!generation) return null;
  const redis = await getRedis();
  return (await redis.json.get(
    packageKey(supplier, generation, packageCode),
  )) as Doc | null;
}

/**
 * Full-text search over `searchText`. Every whitespace-separated token must
 * match as an infix wildcard (mirrors the previous client-side substring
 * filter), so `urop` finds `Europe` and `испан` finds `Испания`.
 *
 * Returns the matching package codes, or null when the query has no usable
 * tokens (meaning: do not filter).
 */
export async function searchCatalogPackageCodes(
  supplier: string,
  query: string,
): Promise<string[] | null> {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter(Boolean);
  if (tokens.length === 0) return null;

  const generation = await currentGeneration(supplier);
  if (!generation) return [];

  const text = tokens.map((token) => `@searchText:(w'*${token}*')`).join(" ");
  const redis = await getRedis();
  const reply = await redis.ft.search(
    CATALOG_INDEX,
    `@supplier:{${escapeTag(supplier)}} @generation:{${generation}} ${text}`,
    {
      RETURN: ["packageCode"],
      LIMIT: { from: 0, size: MAX_RESULTS },
      DIALECT: 2,
    },
  );
  return reply.documents
    .map((doc) => (doc.value as { packageCode?: string }).packageCode)
    .filter((code): code is string => typeof code === "string");
}
