import "server-only";

import { esimAccessPost } from "~/server/suppliers/esimaccess/client";

/**
 * Merchant balance in eSIM Access scale (10000 = $1.00 USD).
 * Called before payment is finalized so we can confirm we can fulfill the order.
 */
export async function checkBalance() {
  const payload = await esimAccessPost<{ balance: number }>("/balance/query");
  const balance = payload.obj?.balance;

  if (typeof balance !== "number" || !Number.isFinite(balance)) {
    throw new Error("eSIM Access balance/query response was invalid");
  }

  return balance;
}
