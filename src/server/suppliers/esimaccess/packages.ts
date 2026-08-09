import { createHmac, randomUUID } from "node:crypto";

const ESIMACCESS_API_BASE = "https://api.esimaccess.com/api/v1/open";

export const ESIMACCESS_PACKAGES_REDIS_KEY = "esimaccess:packages";

export type EsimAccessPackage = {
  packageCode: string;
  slug: string;
  name: string;
  price: number;
  retailPrice: number;
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

// https://api.frankfurter.dev/v2/rate/USD/RUB
