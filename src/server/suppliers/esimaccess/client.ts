import "server-only";

import { createHmac, randomUUID } from "node:crypto";

export const ESIMACCESS_API_BASE = "https://api.esimaccess.com/api/v1/open";

function esimAccessCode() {
  const code = process.env.ESIMACCESS_ACCESS_CODE;
  if (!code) {
    throw new Error("ESIMACCESS_ACCESS_CODE is not set");
  }
  return code;
}

export type EsimAccessEnvelope<T> = {
  success: boolean;
  errorCode?: string;
  errorMsg?: string | null;
  obj?: T;
};

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

export async function esimAccessPost<T>(
  path: string,
  payload: unknown = {},
): Promise<EsimAccessEnvelope<T>> {
  const body = JSON.stringify(payload);
  const response = await fetch(`${ESIMACCESS_API_BASE}${path}`, {
    method: "POST",
    headers: buildSignedHeaders(esimAccessCode(), body),
    body,
  });

  const endpoint = path.replace(/^\//, "");

  if (!response.ok) {
    throw new Error(
      `eSIM Access ${endpoint} failed: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const envelope = (await response.json()) as EsimAccessEnvelope<T>;

  if (!envelope.success) {
    throw new Error(
      `eSIM Access ${endpoint} error: ${envelope.errorCode ?? "unknown"} ${envelope.errorMsg ?? ""}`.trim(),
    );
  }

  return envelope;
}
