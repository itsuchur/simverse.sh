import "server-only";

import { timingSafeEqual } from "node:crypto";

import { env } from "~/env";

const PLATEGA_API_BASE = "https://app.platega.io";

export type PlategaCurrency = "RUB" | "USD";

export type PlategaTransaction = {
  transactionId: string;
  redirect: string;
};

type PlategaCreateResponse = {
  transactionId?: string;
  redirect?: string;
  status?: string;
  message?: string;
};

export type PlategaCancelSupported = {
  supported: boolean;
  totalDeductUsdt: number;
  penaltyUsdt: number | null;
  blockReason: string | null;
};

export type PlategaCancelResult = {
  transactionId: string;
  accepted: boolean;
  manualControlRequired: boolean;
  message: string;
};

function valuesEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

function plategaAuthHeaders(extra?: Record<string, string>) {
  return {
    Accept: "text/plain",
    "X-MerchantId": env.PLATEGA_MERCHANT_ID!,
    "X-Secret": env.PLATEGA_SECRET!,
    ...extra,
  };
}

export function plategaConfigured() {
  return (
    typeof env.PLATEGA_MERCHANT_ID === "string" &&
    env.PLATEGA_MERCHANT_ID.length > 0 &&
    typeof env.PLATEGA_SECRET === "string" &&
    env.PLATEGA_SECRET.length > 0
  );
}

export function verifyPlategaCallbackCredentials(input: {
  merchantId: string;
  secret: string;
}) {
  if (!plategaConfigured()) {
    return false;
  }
  return (
    valuesEqual(input.merchantId, env.PLATEGA_MERCHANT_ID!) &&
    valuesEqual(input.secret, env.PLATEGA_SECRET!)
  );
}

export function plategaPaymentMethod(currency: PlategaCurrency) {
  return currency === "RUB" ? 11 : 12;
}

export async function createPlategaTransaction(input: {
  amount: number;
  orderId: string;
  description: string;
  currency: PlategaCurrency;
  paymentMethod?: 2 | 11 | 12;
  returnUrl: string;
  failedUrl: string;
}): Promise<PlategaTransaction> {
  if (!plategaConfigured()) {
    throw new Error("platega_not_configured");
  }

  const response = await fetch(`${PLATEGA_API_BASE}/transaction/process`, {
    method: "POST",
    headers: plategaAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      paymentMethod:
        input.paymentMethod ?? plategaPaymentMethod(input.currency),
      paymentDetails: {
        amount: input.amount,
        currency: input.currency,
      },
      description: input.description,
      return: input.returnUrl,
      failedUrl: input.failedUrl,
      payload: input.orderId,
      orderId: input.orderId,
    }),
  });

  const payload = (await response
    .json()
    .catch(() => null)) as PlategaCreateResponse | null;
  if (
    !response.ok ||
    !payload?.transactionId ||
    !payload.redirect ||
    payload.status !== "PENDING"
  ) {
    throw new Error(
      `Platega transaction failed: ${payload?.message ?? response.statusText}`,
    );
  }

  return {
    transactionId: payload.transactionId,
    redirect: payload.redirect,
  };
}

export async function checkPlategaCancelSupported(
  transactionId: string,
): Promise<PlategaCancelSupported> {
  if (!plategaConfigured()) {
    throw new Error("platega_not_configured");
  }

  const response = await fetch(
    `${PLATEGA_API_BASE}/transaction/${transactionId}/cancel-supported`,
    {
      method: "GET",
      headers: plategaAuthHeaders(),
    },
  );

  const payload = (await response.json().catch(() => null)) as {
    supported?: boolean;
    totalDeductUsdt?: number;
    penaltyUsdt?: number | null;
    blockReason?: string | null;
    message?: string;
  } | null;

  if (!response.ok || typeof payload?.supported !== "boolean") {
    throw new Error(
      `Platega cancel-supported failed: ${payload?.message ?? response.statusText}`,
    );
  }

  return {
    supported: payload.supported,
    totalDeductUsdt:
      typeof payload.totalDeductUsdt === "number" ? payload.totalDeductUsdt : 0,
    penaltyUsdt:
      typeof payload.penaltyUsdt === "number" ? payload.penaltyUsdt : null,
    blockReason:
      typeof payload.blockReason === "string" ? payload.blockReason : null,
  };
}

export async function cancelPlategaTransaction(
  transactionId: string,
): Promise<PlategaCancelResult> {
  if (!plategaConfigured()) {
    throw new Error("platega_not_configured");
  }

  const response = await fetch(
    `${PLATEGA_API_BASE}/transaction/${transactionId}/cancel`,
    {
      method: "POST",
      headers: plategaAuthHeaders(),
    },
  );

  const payload = (await response.json().catch(() => null)) as {
    transactionId?: string;
    accepted?: boolean;
    manualControlRequired?: boolean;
    message?: string;
  } | null;

  if (
    !response.ok ||
    !payload?.transactionId ||
    typeof payload.accepted !== "boolean" ||
    typeof payload.manualControlRequired !== "boolean" ||
    typeof payload.message !== "string"
  ) {
    throw new Error(
      `Platega cancel failed: ${payload?.message ?? response.statusText}`,
    );
  }

  return {
    transactionId: payload.transactionId,
    accepted: payload.accepted,
    manualControlRequired: payload.manualControlRequired,
    message: payload.message,
  };
}
