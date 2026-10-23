import { beforeEach, expect, mock, test } from "bun:test";
import { fakeDb } from "~/test/fake-db";
import { ZodError } from "zod";
import { resetTestState } from "~/test/mocks";

void mock.module("~/server/better-auth/server", () => ({
  getSession: async () => ({ user: { id: "user-1" } }),
}));
const { updateDataUsageNotificationsAction } = await import("./actions");

beforeEach(() => {
  resetTestState();
  fakeDb.seedUser({
    id: "user-1",
    telegramId: "42",
    dataUsageNotifications: true,
  });
});

test("rejects forged non-boolean notification values before changing the database", async () => {
  for (const input of ["false", 0, null, undefined, {}, { set: false }]) {
    const error = await updateDataUsageNotificationsAction(
      input as unknown as boolean,
    ).catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ZodError);
  }
  const user = await fakeDb.user.findUnique({ where: { id: "user-1" } });
  expect(user?.dataUsageNotifications).toBe(true);
});

test("accepts true and false for the signed-in user's preference", async () => {
  await updateDataUsageNotificationsAction(false);
  expect(
    (await fakeDb.user.findUnique({ where: { id: "user-1" } }))
      ?.dataUsageNotifications,
  ).toBe(false);
  await updateDataUsageNotificationsAction(true);
  expect(
    (await fakeDb.user.findUnique({ where: { id: "user-1" } }))
      ?.dataUsageNotifications,
  ).toBe(true);
});
