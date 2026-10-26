import "server-only";

import { esimAccessPost } from "~/server/suppliers/esimaccess/client";

/**
 * Merchant balance in eSIM Access scale (10000 = $1.00 USD).
 * Called before payment is finalized so we can confirm we can fulfill the order.
 */
export async function fetchBalance() {
  const payload = await esimAccessPost<{ balance: number }>("/balance/query");
  const balance = payload.obj?.balance;

  if (
    typeof balance !== "number" ||
    !Number.isSafeInteger(balance) ||
    balance < 0
  ) {
    throw new Error("eSIM Access balance/query response was invalid");
  }

  return balance;
}

const BALANCE_CACHE_MS = 5_000;
let snapshot: { value: number; expiresAt: number } | undefined;
let inFlight: Promise<number> | undefined;

/** Balance is a preflight check, not a reservation. Share short-lived results
 * and in-flight requests so page views cannot fan out supplier balance calls. */
export async function checkBalance(): Promise<number> {
  if (snapshot && snapshot.expiresAt > Date.now()) return snapshot.value;
  inFlight ??= fetchBalance()
    .then((value) => {
      snapshot = { value, expiresAt: Date.now() + BALANCE_CACHE_MS };
      return value;
    })
    .finally(() => {
      inFlight = undefined;
    });
  return inFlight;
}

/**
 * Re-check the supplier before auto-refunding a failed new eSIM or top-up.
 * Uses a fresh balance read (not the short-lived checkout cache). Returns
 * false on any uncertainty so the order can stay eligible for recovery.
 */
export async function confirmInsufficientBalanceFailure(input: {
  resellerOrderId: string | null;
  esimIccid: string | null;
  costAmount: bigint | null;
  topupOfOrderId: bigint | null;
}): Promise<boolean> {
  if (input.resellerOrderId || input.esimIccid) return false;
  if (input.costAmount === null || input.costAmount <= 0n) return false;
  try {
    const balance = await fetchBalance();
    return BigInt(balance) < input.costAmount;
  } catch {
    return false;
  }
}
