import "server-only";

import { getRedis } from "~/server/redis";

export const USAGE_CHECK_LIMIT = 5;
export const USAGE_CHECK_WINDOW_SECONDS = 300;

function usageCheckKey(userId: string) {
  return `myesim:usage-check:${userId}`;
}

/**
 * Fixed-window counter: INCR, set EXPIRE on first hit.
 * Returns "limited" once the count exceeds USAGE_CHECK_LIMIT.
 */
export async function consumeUsageCheckAttempt(
  userId: string,
): Promise<"ok" | "limited"> {
  const redis = await getRedis();
  const count = Number(
    await redis.eval(
      `
        local c = redis.call('INCR', KEYS[1])
        if c == 1 then
          redis.call('EXPIRE', KEYS[1], ARGV[1])
        end
        return c
      `,
      {
        keys: [usageCheckKey(userId)],
        arguments: [String(USAGE_CHECK_WINDOW_SECONDS)],
      },
    ),
  );
  return count > USAGE_CHECK_LIMIT ? "limited" : "ok";
}
