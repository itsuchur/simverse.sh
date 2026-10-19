import "server-only";

import { getRedis } from "~/server/redis";

export const PRICE_MODIFIER_KEY = "PRICE_MODIFIER";
export const DEFAULT_PRICE_MODIFIER = 1;

function parsePriceModifier(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function priceModifierFromEnv() {
  return parsePriceModifier(process.env.PRICE_MODIFIER) ?? DEFAULT_PRICE_MODIFIER;
}

/** SETNX from env (default 1) so dashboard edits survive restarts. */
export async function ensurePriceModifierSeeded() {
  const redis = await getRedis();
  await redis.set(PRICE_MODIFIER_KEY, String(priceModifierFromEnv()), {
    NX: true,
  });
}

export async function getPriceModifier() {
  const redis = await getRedis();
  return (
    parsePriceModifier(await redis.get(PRICE_MODIFIER_KEY)) ??
    DEFAULT_PRICE_MODIFIER
  );
}

export async function setPriceModifier(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("PRICE_MODIFIER must be a positive finite number");
  }
  const redis = await getRedis();
  await redis.set(PRICE_MODIFIER_KEY, String(value));
}
