import "server-only";

import { z } from "zod";

import { getRedis } from "~/server/redis";

export const SBP_PROVIDER_KEY = "SBP_PROVIDER";

export const sbpProviderSchema = z.enum(["xhub", "platega"]);
export type SbpProvider = z.infer<typeof sbpProviderSchema>;

const DEFAULT_SBP_PROVIDER: SbpProvider = "xhub";

/** Provider that handles SBP payments for new eSIM purchases. */
export async function getSbpProvider(): Promise<SbpProvider> {
  const redis = await getRedis();
  const parsed = sbpProviderSchema.safeParse(
    await redis.get(SBP_PROVIDER_KEY),
  );
  return parsed.success ? parsed.data : DEFAULT_SBP_PROVIDER;
}

export async function setSbpProvider(provider: SbpProvider) {
  const redis = await getRedis();
  await redis.set(SBP_PROVIDER_KEY, provider);
}
