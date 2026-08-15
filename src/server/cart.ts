import "server-only";

import { cartPlanSchema, type CartPlan } from "~/lib/cart-plan";
import { getRedis } from "~/server/redis";
import {
  ESIMACCESS_PRICE_SCALE,
  getCachedEsimAccessPackages,
  retailPriceToRub,
  retailPriceToStars,
  type EsimAccessPackage,
} from "~/server/suppliers/esimaccess/packages";

export const CART_TTL_SECONDS = 86_400;

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
    price: pkg.retailPrice / ESIMACCESS_PRICE_SCALE,
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

export async function replaceCartPlan(telegramId: string, plan: CartPlan) {
  const redis = await getRedis();
  const key = cartKey(telegramId);
  await redis
    .multi()
    .del(key)
    .hSet(key, `plan:${plan.slug}`, JSON.stringify(plan))
    .expire(key, CART_TTL_SECONDS)
    .exec();
}

export async function clearCart(telegramId: string) {
  const redis = await getRedis();
  await redis.del(cartKey(telegramId));
}

export async function getCartPlan(
  telegramId: string,
): Promise<CartPlan | null> {
  const redis = await getRedis();
  const fields = await redis.hGetAll(cartKey(telegramId));
  const entry = Object.entries(fields).find(([field]) =>
    field.startsWith("plan:"),
  );
  if (!entry) {
    return null;
  }

  try {
    const parsed = cartPlanSchema.safeParse(JSON.parse(entry[1]));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function cartPlanForPackageCode(
  packageCode: string,
): Promise<CartPlan> {
  const cached = await getCachedEsimAccessPackages();
  const pkg = cached?.packageList.find(
    (item) => item.packageCode === packageCode,
  );
  if (!cached || !pkg) {
    throw new UnknownPackageError();
  }
  return cartPlanFromPackage(pkg, cached.usdRubRate);
}
