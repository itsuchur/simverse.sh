import { beforeEach, expect, mock, test } from "bun:test";
import { fakeDb } from "~/test/fake-db";
import { resetTestState } from "~/test/mocks";

let signedIn = true;
let validIdentity = true;
const rates = await import("~/server/http/rate-limit");
void mock.module("~/server/http/rate-limit", () => ({
  ...rates,
  limitMiniappRequest: async () => null,
  limitPrecheckRequest: async () => null,
}));
void mock.module("~/server/better-auth", () => ({
  getAuth: () => ({
    api: {
      getSession: async () =>
        signedIn ? { user: { id: "user-1", telegramId: "42" } } : null,
      validateMiniApp: async () => ({
        valid: validIdentity,
        data: { user: { id: 42 } },
      }),
    },
  }),
}));
const { POST: restore } = await import("./route");
const { POST: precheck } = await import("../precheck/route");

beforeEach(() => {
  resetTestState();
  signedIn = true;
  validIdentity = true;
});
function request(path: string, body?: unknown) {
  return new Request(`http://localhost/api/account/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test("only deleted accounts require restoration; new and active users sign in normally", async () => {
  expect(
    await (await precheck(request("precheck", { initData: "signed" }))).json(),
  ).toEqual({ requiresRestoration: false });
  const user = fakeDb.seedUser({ id: "user-1", telegramId: "42" });
  expect(
    await (await precheck(request("precheck", { initData: "signed" }))).json(),
  ).toEqual({ requiresRestoration: false });
  user.isDeleted = true;
  const response = await precheck(request("precheck", { initData: "signed" }));
  expect(await response.json()).toEqual({ requiresRestoration: true });
  expect(response.headers.get("cache-control")).toBe("no-store");
});

test("invalid Telegram identity cannot reveal restoration state", async () => {
  validIdentity = false;
  expect(
    (await precheck(request("precheck", { initData: "forged" }))).status,
  ).toBe(401);
});

test("restoration requires a session and explicit true confirmation", async () => {
  const deletedAt = new Date();
  const user = fakeDb.seedUser({
    id: "user-1",
    telegramId: "42",
    isDeleted: true,
    deletedAt,
  });
  for (const body of [
    undefined,
    {},
    { confirmed: false },
    { confirmed: "true" },
  ]) {
    expect((await restore(request("restore", body))).status).toBe(400);
    expect(user.isDeleted).toBe(true);
    expect(user.deletedAt).toBe(deletedAt);
  }
  signedIn = false;
  expect((await restore(request("restore", { confirmed: true }))).status).toBe(
    401,
  );
  signedIn = true;
  expect((await restore(request("restore", { confirmed: true }))).status).toBe(
    204,
  );
  expect(user.isDeleted).toBe(false);
  expect(user.deletedAt).toBeNull();
});
