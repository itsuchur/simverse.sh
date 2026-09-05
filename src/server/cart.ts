import "server-only";

import { randomUUID } from "node:crypto";

import { cartPlanSchema, type CartPlan } from "~/lib/cart-plan";
import { getRedis } from "~/server/redis";
import {
  getEsimAccessPackageByCode,
  retailPriceToRub,
  retailPriceToStars,
  retailPriceToUsd,
  type EsimAccessPackage,
} from "~/server/suppliers/esimaccess/packages";

export const CART_TTL_SECONDS = 86_400;

type StoredCart = {
  revision: string;
  plan: CartPlan;
};

export class UnknownPackageError extends Error {
  constructor() {
    super("Unknown package");
    this.name = "UnknownPackageError";
  }
}

export class CatalogIncompleteError extends Error {
  constructor() {
    super("Catalog prices are incomplete");
    this.name = "CatalogIncompleteError";
  }
}

function cartKey(telegramId: string) {
  return `cart:${telegramId}`;
}

function operatorNames(
  locationNetworkList: EsimAccessPackage["locationNetworkList"],
): string[] {
  if (!locationNetworkList?.length) {
    return [];
  }

  const seen = new Set<string>();
  const names: string[] = [];

  for (const location of locationNetworkList) {
    if (!location || typeof location !== "object") continue;
    const operatorList = (location as { operatorList?: unknown }).operatorList;
    if (!Array.isArray(operatorList)) continue;

    for (const operator of operatorList) {
      if (!operator || typeof operator !== "object") continue;
      const name = (operator as { operatorName?: unknown }).operatorName;
      if (typeof name !== "string" || !name.trim()) continue;
      const operatorName = name.trim();
      if (seen.has(operatorName)) continue;
      seen.add(operatorName);
      names.push(operatorName);
    }
  }

  return names;
}

export function cartPlanFromPackage(
  pkg: EsimAccessPackage,
  usdRubRate?: number,
): CartPlan {
  const priceStars =
    typeof pkg.priceStars === "number" && Number.isFinite(pkg.priceStars)
      ? pkg.priceStars
      : retailPriceToStars(pkg.retailPrice);
  const priceRub =
    typeof pkg.priceRub === "number" && Number.isFinite(pkg.priceRub)
      ? pkg.priceRub
      : typeof usdRubRate === "number"
        ? retailPriceToRub(pkg.retailPrice, usdRubRate)
        : undefined;

  if (
    typeof priceRub !== "number" ||
    !Number.isFinite(priceRub) ||
    !Number.isFinite(priceStars)
  ) {
    throw new CatalogIncompleteError();
  }

  return cartPlanSchema.parse({
    supplier: "esimaccess",
    packageCode: pkg.packageCode,
    slug: pkg.slug,
    country: pkg.location,
    data_gb: pkg.volume / 1024 ** 3,
    validity_days: pkg.duration,
    price: retailPriceToUsd(pkg.retailPrice),
    price_rub: priceRub,
    price_stars: priceStars,
    cost: pkg.price,
    currency: "USD",
    qty: 1,
    networks: operatorNames(pkg.locationNetworkList),
    name: pkg.name,
    nameRu: pkg.nameRu,
  });
}

function parseStoredCart(value: unknown): {
  plan: CartPlan;
  revision: string | null;
} | null {
  if (
    value &&
    typeof value === "object" &&
    "revision" in value &&
    "plan" in value
  ) {
    const stored = value as { revision?: unknown; plan?: unknown };
    const parsed = cartPlanSchema.safeParse(stored.plan);
    if (
      parsed.success &&
      typeof stored.revision === "string" &&
      stored.revision.length > 0
    ) {
      return { plan: parsed.data, revision: stored.revision };
    }
  }

  // Backward compatibility for carts written before revision tracking.
  const legacy = cartPlanSchema.safeParse(value);
  return legacy.success ? { plan: legacy.data, revision: null } : null;
}

export async function replaceCartPlan(telegramId: string, plan: CartPlan) {
  const redis = await getRedis();
  const key = cartKey(telegramId);
  const stored: StoredCart = { revision: randomUUID(), plan };
  await redis
    .multi()
    .json.set(key, "$", stored)
    .expire(key, CART_TTL_SECONDS)
    .exec();
}

export async function clearCart(telegramId: string) {
  const redis = await getRedis();
  await redis.del(cartKey(telegramId));
}

export async function clearCartIfRevisionMatches(
  telegramId: string,
  revision: string | null,
) {
  // Orders/checkouts created before revision tracking must never delete a cart
  // that may have been replaced since that invoice was opened.
  if (!revision) {
    return false;
  }

  const redis = await getRedis();
  const result = await redis.eval(
    `
      local raw = redis.call('JSON.GET', KEYS[1])
      if not raw then
        return 0
      end
      local cart = cjson.decode(raw)
      if cart.revision ~= ARGV[1] then
        return 0
      end
      return redis.call('DEL', KEYS[1])
    `,
    { keys: [cartKey(telegramId)], arguments: [revision] },
  );
  return Number(result) > 0;
}

export async function getCartSnapshot(
  telegramId: string,
): Promise<{ plan: CartPlan; revision: string | null } | null> {
  const redis = await getRedis();
  const value = await redis.json.get(cartKey(telegramId));
  if (value === null) {
    return null;
  }
  return parseStoredCart(value);
}

export async function getCartPlan(
  telegramId: string,
): Promise<CartPlan | null> {
  return (await getCartSnapshot(telegramId))?.plan ?? null;
}

export async function cartPlanForPackageCode(
  packageCode: string,
): Promise<CartPlan> {
  const found = await getEsimAccessPackageByCode(packageCode);
  if (!found) {
    throw new UnknownPackageError();
  }
  return cartPlanFromPackage(found.pkg, found.meta.usdRubRate);
}
