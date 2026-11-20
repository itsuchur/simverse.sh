import { beforeEach, describe, expect, mock, test } from "bun:test";

const store = new Map<string, string>();

void mock.module("~/server/redis", () => ({
  getRedis: async () => ({
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: string) => {
      store.set(key, value);
    },
  }),
}));

const { getSbpProvider, setSbpProvider, SBP_PROVIDER_KEY } = await import(
  "~/server/sbp-provider"
);

beforeEach(() => {
  store.clear();
});

describe("SBP provider", () => {
  test("defaults to X-Hub when unset", async () => {
    expect(await getSbpProvider()).toBe("xhub");
  });

  test("defaults to X-Hub for an unknown stored value", async () => {
    store.set(SBP_PROVIDER_KEY, "cardlink");
    expect(await getSbpProvider()).toBe("xhub");
  });

  test("returns the provider chosen on the dashboard", async () => {
    await setSbpProvider("platega");
    expect(await getSbpProvider()).toBe("platega");
    await setSbpProvider("xhub");
    expect(await getSbpProvider()).toBe("xhub");
  });
});
