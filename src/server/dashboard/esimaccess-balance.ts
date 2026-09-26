import "server-only";

import { ESIMACCESS_PRICE_SCALE } from "~/server/suppliers/esimaccess/packages";
import { checkBalance } from "~/server/suppliers/esimaccess/balance-check";

export type EsimAccessBalanceResult =
  | { ok: true; balanceScaled: number; balanceUsd: number }
  | { ok: false; error: string };

/** Merchant balance from eSIM Access `/balance/query` (10000 = $1.00). */
export async function getEsimAccessBalance(): Promise<EsimAccessBalanceResult> {
  try {
    const balanceScaled = await checkBalance();
    return {
      ok: true,
      balanceScaled,
      balanceUsd: balanceScaled / ESIMACCESS_PRICE_SCALE,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Balance unavailable",
    };
  }
}

export function formatEsimAccessBalanceUsd(balanceUsd: number): string {
  return balanceUsd.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
