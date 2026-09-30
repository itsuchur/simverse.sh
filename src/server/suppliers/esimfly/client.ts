import "server-only";

import { ESIMfly } from "@esimfly/sdk";

/**
 * The SDK signs requests (HMAC-SHA256), retries safe GETs and paces catalog
 * paging at 1 req/s, so no hand-written HTTP client is needed.
 */

export function isEsimflyConfigured() {
  return Boolean(
    process.env.ESIMFLY_ACCESS_CODE && process.env.ESIMFLY_SECRET_KEY,
  );
}

export function getEsimflyClient(
  fetchImpl?: ConstructorParameters<typeof ESIMfly>[0]["fetch"],
) {
  const accessCode = process.env.ESIMFLY_ACCESS_CODE;
  const secretKey = process.env.ESIMFLY_SECRET_KEY;
  if (!accessCode || !secretKey) {
    throw new Error("ESIMFLY_ACCESS_CODE and ESIMFLY_SECRET_KEY are not set");
  }
  return new ESIMfly({
    accessCode,
    secretKey,
    userAgent: "simverse.sh",
    fetch: fetchImpl,
  });
}
