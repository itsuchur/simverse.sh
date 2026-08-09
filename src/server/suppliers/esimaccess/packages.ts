import { createHmac, randomUUID } from "node:crypto";

const ESIMACCESS_API_BASE = "https://api.esimaccess.com/api/v1/open";

export const ESIMACCESS_PACKAGES_REDIS_KEY = "esimaccess:packages";

/** Supplier money amounts use 10000 = $1.00 (USD). */
export const ESIMACCESS_PRICE_SCALE = 10_000;

export type EsimAccessPackage = {
  packageCode: string;
  slug: string;
  name: string;
  price: number;
  retailPrice: number;
  /** Customer-facing price in whole rubles, from retailPrice × USD/RUB. */
  priceRub?: number;
  currencyCode: string;
  volume: number;
  duration: number;
  durationUnit: string;
  location: string;
  speed?: string;
  supportTopUpType?: number;
  activeType?: number;
  locationNetworkList?: unknown[];
};

type EsimAccessPackageListResponse = {
  success: boolean;
  errorCode?: string;
  errorMsg?: string | null;
  obj?: {
    packageList?: EsimAccessPackage[];
  };
};

function getAccessCode() {
  const accessCode = process.env.ESIMACCESS_ACCESS_CODE;
  if (!accessCode) {
    throw new Error("ESIMACCESS_ACCESS_CODE is not set");
  }
  return accessCode;
}

function buildSignedHeaders(accessCode: string, body: string) {
  const timestamp = Date.now().toString();
  const requestId = randomUUID();
  const signString = `${timestamp}${requestId}${accessCode}${body}`;
  const signature = createHmac("sha256", accessCode)
    .update(signString)
    .digest("hex")
    .toLowerCase();

  return {
    "Content-Type": "application/json",
    "RT-AccessCode": accessCode,
    "RT-Timestamp": timestamp,
    "RT-RequestID": requestId,
    "RT-Signature": signature,
  };
}

export async function fetchEsimAccessPackages() {
  // Empty filters return the full catalog.
  const body = JSON.stringify({});
  const response = await fetch(`${ESIMACCESS_API_BASE}/package/list`, {
    method: "POST",
    headers: buildSignedHeaders(getAccessCode(), body),
    body,
  });

  if (!response.ok) {
    throw new Error(
      `eSIM Access package/list failed: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const payload = (await response.json()) as EsimAccessPackageListResponse;

  if (!payload.success) {
    throw new Error(
      `eSIM Access package/list error: ${payload.errorCode ?? "unknown"} ${payload.errorMsg ?? ""}`.trim(),
    );
  }

  return payload.obj?.packageList ?? [];
}

const FRANKFURTER_USD_RUB_URL = "https://api.frankfurter.dev/v2/rate/USD/RUB";

type FrankfurterRateResponse = {
  base: string;
  quote: string;
  rate: number;
  date: string;
};

export async function fetchUsdRubRate() {
  const response = await fetch(FRANKFURTER_USD_RUB_URL);

  if (!response.ok) {
    throw new Error(
      `Frankfurter USD/RUB rate failed: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const payload = (await response.json()) as FrankfurterRateResponse;

  if (
    payload.base !== "USD" ||
    payload.quote !== "RUB" ||
    typeof payload.rate !== "number" ||
    !Number.isFinite(payload.rate) ||
    payload.rate <= 0
  ) {
    throw new Error("Frankfurter USD/RUB rate response was invalid");
  }

  return { rate: payload.rate, date: payload.date };
}

/** retailPrice is USD with scale 10000 = $1; returns whole rubles. */
export function retailPriceToRub(
  retailPrice: number,
  usdRubRate: number,
): number {
  return Math.round((retailPrice / ESIMACCESS_PRICE_SCALE) * usdRubRate);
}

export function withPriceRub(
  packages: EsimAccessPackage[],
  usdRubRate: number,
): EsimAccessPackage[] {
  return packages.map((pkg) => ({
    ...pkg,
    priceRub: retailPriceToRub(pkg.retailPrice, usdRubRate),
  }));
}
