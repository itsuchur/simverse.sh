import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import {
  checkBalance,
  confirmInsufficientBalanceFailure,
} from "./balance-check";
import { esimAccessPost, resetTestState } from "~/test/mocks";

let clock = Date.now();
let time: ReturnType<typeof spyOn<typeof Date, "now">>;
beforeEach(() => {
  resetTestState();
  clock += 10_000;
  time = spyOn(Date, "now").mockImplementation(() => clock);
});
afterEach(() => time.mockRestore());

test("a concurrent burst shares one balance request and refreshes after five seconds", async () => {
  esimAccessPost.mockResolvedValue({
    success: true,
    obj: { balance: 100_000 },
  });
  const results = await Promise.all(
    Array.from({ length: 30 }, () => checkBalance()),
  );
  expect(results.every((result) => result === 100_000)).toBe(true);
  expect(esimAccessPost).toHaveBeenCalledTimes(1);
  expect(await checkBalance()).toBe(100_000);
  expect(esimAccessPost).toHaveBeenCalledTimes(1);
  clock += 5_001;
  esimAccessPost.mockResolvedValue({ success: true, obj: { balance: 90_000 } });
  expect(await checkBalance()).toBe(90_000);
  expect(esimAccessPost).toHaveBeenCalledTimes(2);
});

test("failed supplier requests are not cached", async () => {
  esimAccessPost.mockRejectedValueOnce(new Error("Supplier unavailable"));
  const error = await checkBalance().catch((error: unknown) => error);
  expect(error).toBeInstanceOf(Error);
  expect(error).toMatchObject({ message: "Supplier unavailable" });
  esimAccessPost.mockResolvedValue({ success: true, obj: { balance: 80_000 } });
  expect(await checkBalance()).toBe(80_000);
  expect(esimAccessPost).toHaveBeenCalledTimes(2);
});

test("confirmInsufficientBalanceFailure requires a fresh low balance and no supplier ids", async () => {
  esimAccessPost.mockResolvedValue({ success: true, obj: { balance: 100 } });
  expect(
    await confirmInsufficientBalanceFailure({
      resellerOrderId: null,
      esimIccid: null,
      costAmount: 500n,
      topupOfOrderId: null,
    }),
  ).toBe(true);
  expect(
    await confirmInsufficientBalanceFailure({
      resellerOrderId: null,
      esimIccid: null,
      costAmount: 500n,
      topupOfOrderId: 1n,
    }),
  ).toBe(true);
  expect(esimAccessPost.mock.calls.some((call) => call[0] === "/balance/query")).toBe(
    true,
  );

  expect(
    await confirmInsufficientBalanceFailure({
      resellerOrderId: "EA-1",
      esimIccid: null,
      costAmount: 500n,
      topupOfOrderId: null,
    }),
  ).toBe(false);

  esimAccessPost.mockResolvedValue({ success: true, obj: { balance: 900 } });
  expect(
    await confirmInsufficientBalanceFailure({
      resellerOrderId: null,
      esimIccid: null,
      costAmount: 500n,
      topupOfOrderId: null,
    }),
  ).toBe(false);

  esimAccessPost.mockRejectedValueOnce(new Error("Supplier unavailable"));
  expect(
    await confirmInsufficientBalanceFailure({
      resellerOrderId: null,
      esimIccid: null,
      costAmount: 500n,
      topupOfOrderId: null,
    }),
  ).toBe(false);
});
