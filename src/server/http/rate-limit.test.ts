import { describe, expect, test } from "bun:test";
import { RateLimiterMemory, RateLimiterRes } from "rate-limiter-flexible";
import {
  createRequestLimitGuard,
  REQUEST_LIMITS,
  type RequestLimitScope,
} from "./rate-limit";

function memoryGuard() {
  const stores = new Map<RequestLimitScope, RateLimiterMemory>();
  const resolve = async (scope: RequestLimitScope) => {
    let store = stores.get(scope);
    if (!store) {
      store = new RateLimiterMemory({
        points: REQUEST_LIMITS[scope],
        duration: 60,
      });
      stores.set(scope, store);
    }
    return store;
  };
  return createRequestLimitGuard(resolve);
}

describe("request limits", () => {
  test("concurrent checkout attempts share a quota and other users remain independent", async () => {
    const guard = memoryGuard();
    const results = await Promise.all(
      Array.from({ length: 30 }, () => guard("user-1", "checkout")),
    );
    expect(results.filter((result) => result === null)).toHaveLength(
      REQUEST_LIMITS.checkout,
    );
    const blocked = results.find((result) => result?.status === 429);
    expect(blocked).toBeDefined();
    expect(Number(blocked?.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(await guard("user-2", "checkout")).toBeNull();
    expect(await guard("user-1", "cart")).toBeNull();
  });

  test("rounds Retry-After up and allows requests when the store window resets", async () => {
    let limited = true;
    const guard = createRequestLimitGuard(async () => ({
      consume: async () => {
        if (limited) {
          // Match rate-limiter-flexible's documented non-Error rejection.
          // eslint-disable-next-line @typescript-eslint/only-throw-error
          throw new RateLimiterRes(0, 1_001, 11);
        }
        return new RateLimiterRes(9, 60_000, 1);
      },
    }));
    const response = await guard("user-1", "checkout");
    expect(response?.status).toBe(429);
    expect(response?.headers.get("Retry-After")).toBe("2");
    limited = false;
    expect(await guard("user-1", "checkout")).toBeNull();
  });

  test("fails closed with 503 when the shared store is unavailable", async () => {
    const guard = createRequestLimitGuard(async () => {
      throw new Error("Redis down");
    });
    const response = await guard("user-1", "checkout");
    expect(response?.status).toBe(503);
    expect(await response?.json()).toEqual({ error: "unavailable" });
  });
});
