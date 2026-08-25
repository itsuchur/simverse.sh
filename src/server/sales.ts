import "server-only";

import { getRedis } from "~/server/redis";

export const SALES_ACTIVE_KEY = "SALES_ACTIVE";

function parseSalesActive(value: string | null) {
  return value === "true" || value === "True" || value === "1";
}

export async function isSalesActive() {
  const redis = await getRedis();
  return parseSalesActive(await redis.get(SALES_ACTIVE_KEY));
}

export async function setSalesActive(active: boolean) {
  const redis = await getRedis();
  await redis.set(SALES_ACTIVE_KEY, active ? "true" : "false");
}
