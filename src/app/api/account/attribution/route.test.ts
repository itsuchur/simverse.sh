import { beforeEach, describe, expect, mock, test } from "bun:test";

import { rememberTelegramStart } from "~/server/telegram/telegram-start";
import { fakeDb } from "~/test/fake-db";
import { resetTestState } from "~/test/mocks";

const rateLimitModule = await import("~/server/http/rate-limit");
const limitRequest = mock(
  async (_userId: string, _scope: string): Promise<Response | null> => null,
);
void mock.module("~/server/http/rate-limit", () => ({
  ...rateLimitModule,
  limitMiniappRequest: limitRequest,
}));

let session: { id: string; telegramId: string | null } | null = {
  id: "user-1",
  telegramId: "42",
};
let miniApp: { valid: boolean; data: { user?: { id?: string | number } } | null } =
  { valid: true, data: { user: { id: "42" } } };

void mock.module("~/server/better-auth", () => ({
  getAuth: () => ({
    api: {
      getSession: async () => (session ? { user: session } : null),
      validateMiniApp: async () => miniApp,
    },
  }),
}));

const { POST } = await import("~/app/api/account/attribution/route");

function post(initData: string) {
  return POST(
    new Request("http://localhost/api/account/attribution", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    }),
  );
}

async function storedSource() {
  const user = await fakeDb.user.findUnique({
    where: { id: "user-1" },
    select: { acquisitionSource: true },
  });
  return user?.acquisitionSource ?? null;
}

beforeEach(() => {
  resetTestState();
  limitRequest.mockReset();
  limitRequest.mockResolvedValue(null);
  session = { id: "user-1", telegramId: "42" };
  miniApp = { valid: true, data: { user: { id: "42" } } };
  fakeDb.seedUser({ id: "user-1", telegramId: "42" });
});

describe("POST /api/account/attribution", () => {
  test("stores the first src_ code and keeps it", async () => {
    const first = await post("start_param=src_instagram&hash=1");
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({
      source: "src_instagram",
      openSource: "src_instagram",
    });

    const second = await post("start_param=src_youtube&hash=1");
    expect(await second.json()).toEqual({
      source: "src_instagram",
      openSource: "src_youtube",
    });
    expect(await storedSource()).toBe("src_instagram");
  });

  test("an invalid src_ value is stored as organic", async () => {
    const response = await post("start_param=src_&hash=1");
    expect(await response.json()).toEqual({
      source: "organic",
      openSource: "organic",
    });
    expect(await storedSource()).toBe("organic");
  });

  test("an account older than an hour is left unset", async () => {
    fakeDb.seedUser({
      id: "user-1",
      telegramId: "42",
      createdAt: new Date(Date.now() - 61 * 60 * 1000),
    });

    const response = await post("start_param=src_instagram&hash=1");
    expect(await response.json()).toEqual({
      source: null,
      openSource: "src_instagram",
    });
    expect(await storedSource()).toBeNull();
  });

  test("a /start payload is the first touch and is only used once", async () => {
    await rememberTelegramStart("42", "src_instagram");

    const first = await post("user=%7B%7D&hash=1");
    expect(await first.json()).toEqual({
      source: "src_instagram",
      openSource: "src_instagram",
    });

    const second = await post("user=%7B%7D&hash=1");
    expect(await second.json()).toEqual({
      source: "src_instagram",
      openSource: "organic",
    });
    expect(await storedSource()).toBe("src_instagram");
  });

  test("a later /start does not replace the stored source", async () => {
    await rememberTelegramStart("42", "src_instagram");
    await post("user=%7B%7D&hash=1");
    await rememberTelegramStart("42", "src_youtube");

    const response = await post("user=%7B%7D&hash=1");
    expect(await response.json()).toEqual({
      source: "src_instagram",
      openSource: "src_youtube",
    });
    expect(await storedSource()).toBe("src_instagram");
  });

  test("a mismatched Telegram id is rejected", async () => {
    miniApp = { valid: true, data: { user: { id: "99" } } };

    const response = await post("start_param=src_instagram&hash=1");
    expect(response.status).toBe(401);
    expect(await storedSource()).toBeNull();
  });
});
