import "server-only";

import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { RateLimiterRedis, RateLimiterRes } from "rate-limiter-flexible";
import { getRedis } from "~/server/redis";

// Shared across payment providers and app instances; keyed by authenticated
// user ID, never a client-supplied Telegram ID, cart revision, or order UUID.
export const REQUEST_LIMITS = {
  api: 120,
  account: 30,
  cart: 60,
  checkout: 10,
  topup: 20,
  "profile-sync": 5,
  precheck: 120,
} as const;
export type RequestLimitScope = keyof typeof REQUEST_LIMITS;
export const REQUEST_LIMIT_WINDOW_SECONDS = 60;

type Limiter = Pick<RateLimiterRedis, "consume">;
const limiters = new Map<RequestLimitScope, Promise<Limiter>>();

function getLimiter(scope: RequestLimitScope): Promise<Limiter> {
  let limiter = limiters.get(scope);
  if (!limiter) {
    limiter = getRedis()
      .then(
        (storeClient) =>
          new RateLimiterRedis({
            storeClient,
            useRedisPackage: true,
            rejectIfRedisNotReady: true,
            keyPrefix: `request-limit:${scope}`,
            points: REQUEST_LIMITS[scope],
            duration: REQUEST_LIMIT_WINDOW_SECONDS,
          }),
      )
      .catch((error: unknown) => {
        limiters.delete(scope);
        throw error;
      });
    limiters.set(scope, limiter);
  }
  return limiter;
}

/** Injectable store boundary lets tests exercise the real limiter policy. */
export function createRequestLimitGuard(
  resolve: (scope: RequestLimitScope) => Promise<Limiter>,
) {
  return async (
    identity: string,
    scope: RequestLimitScope,
  ): Promise<Response | null> => {
    try {
      await (await resolve(scope)).consume(identity);
      return null;
    } catch (error) {
      if (error instanceof RateLimiterRes) {
        return Response.json(
          { error: "rate_limited" },
          {
            status: 429,
            headers: {
              "Retry-After": String(
                Math.max(1, Math.ceil(error.msBeforeNext / 1000)),
              ),
            },
          },
        );
      }
      // A Redis outage must not silently remove abuse protection.
      return Response.json(
        { error: "unavailable" },
        {
          status: 503,
          headers: { "Retry-After": "30" },
        },
      );
    }
  };
}

export const limitMiniappRequest = createRequestLimitGuard(getLimiter);

export function limitPrecheckRequest(request: Request) {
  // Traefik overwrites X-Real-IP. Do not trust arbitrary forwarded/CF headers
  // here; direct access to the app must remain restricted to the proxy.
  const rawIp = request.headers.get("x-real-ip")?.trim();
  const identity = rawIp && isIP(rawIp) ? rawIp : "unknown";
  const key = createHash("sha256").update(identity).digest("hex");
  return limitMiniappRequest(key, "precheck");
}
