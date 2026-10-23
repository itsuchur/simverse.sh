import { rejects } from "node:assert/strict";
import { beforeEach, expect, test } from "bun:test";
import { setDashboardUserBanned } from "./ban-user";
import { fakeDb } from "~/test/fake-db";
import { resetTestState } from "~/test/mocks";

beforeEach(resetTestState);
test("ban requires a submitted nonblank reason", async () => {
  const user = fakeDb.seedUser({ id: "customer" });
  for (const reason of [undefined, "", "   ", "x".repeat(501)]) {
    await rejects(setDashboardUserBanned(user.id, true, reason));
    expect(user.isBanned).toBe(false);
    expect(user.banReason).toBeNull();
  }
});
test("stores trimmed ban reason and keeps the note when unbanning", async () => {
  const user = fakeDb.seedUser({ id: "customer" });
  await setDashboardUserBanned(user.id, true, "  Payment abuse  ");
  expect(user.isBanned).toBe(true);
  expect(user.banReason).toBe("Payment abuse");
  await setDashboardUserBanned(user.id, false);
  expect(user.isBanned).toBe(false);
  expect(user.banReason).toBe("Payment abuse");
});
test("dashboard account cannot be banned", async () => {
  const user = fakeDb.seedUser({ id: "staff", email: "support@simverse.sh" });
  await rejects(
    setDashboardUserBanned(user.id, true, "Test"),
    new RegExp("dashboard account"),
  );
  expect(user.isBanned).toBe(false);
});
