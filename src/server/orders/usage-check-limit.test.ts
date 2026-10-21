import { beforeEach, describe, expect, mock, test } from "bun:test";

const counters = new Map<string, number>();

const redisEval = mock(
  async (
    _script: string,
    options: { keys: string[]; arguments: string[] },
  ) => {
    const key = options.keys[0]!;
    const next = (counters.get(key) ?? 0) + 1;
    counters.set(key, next);
    return next;
  },
);

void mock.module("~/server/redis", () => ({
  getRedis: async () => ({ eval: redisEval }),
}));

const { consumeUsageCheckAttempt, USAGE_CHECK_LIMIT } = await import(
  "~/server/orders/usage-check-limit"
);

beforeEach(() => {
  counters.clear();
  redisEval.mockClear();
});

describe("consumeUsageCheckAttempt", () => {
  test("allows the first five attempts in the window", async () => {
    for (let i = 0; i < USAGE_CHECK_LIMIT; i += 1) {
      expect(await consumeUsageCheckAttempt("42")).toBe("ok");
    }
    expect(redisEval).toHaveBeenCalledTimes(USAGE_CHECK_LIMIT);
    expect(redisEval.mock.calls[0]?.[1]).toEqual({
      keys: ["myesim:usage-check:42"],
      arguments: ["300"],
    });
  });

  test("blocks the sixth attempt", async () => {
    for (let i = 0; i < USAGE_CHECK_LIMIT; i += 1) {
      await consumeUsageCheckAttempt("42");
    }
    expect(await consumeUsageCheckAttempt("42")).toBe("limited");
  });

  test("tracks each telegram user separately", async () => {
    for (let i = 0; i < USAGE_CHECK_LIMIT; i += 1) {
      await consumeUsageCheckAttempt("42");
    }
    expect(await consumeUsageCheckAttempt("42")).toBe("limited");
    expect(await consumeUsageCheckAttempt("99")).toBe("ok");
  });
});
