const REDACTED = "[REDACTED]";

function isCredentialKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return (
    normalized === "authorization" ||
    normalized === "proxyauthorization" ||
    normalized === "cookie" ||
    normalized === "setcookie" ||
    normalized.includes("secret") ||
    normalized.includes("token") ||
    normalized.includes("password") ||
    normalized.includes("apikey") ||
    normalized.includes("signature") ||
    normalized === "paypaltransmissionsig" ||
    normalized.includes("privatekey") ||
    normalized.includes("accesscode") ||
    normalized.includes("activationcode") ||
    normalized === "ac" ||
    normalized === "auth"
  );
}

/** Store only sanitized audit data; the handler still receives the original. */
export function redactWebhookValue(value: unknown, depth = 0): unknown {
  if (depth > 32) return "[TRUNCATED]";
  if (Array.isArray(value))
    return value.map((item: unknown) => redactWebhookValue(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        isCredentialKey(key) ? REDACTED : redactWebhookValue(item, depth + 1),
      ]),
    );
  }
  return value;
}

export function redactWebhookHeaders(headers: Headers): Record<string, string> {
  return Object.fromEntries(
    Array.from(headers.entries(), ([key, value]) => [
      key,
      isCredentialKey(key) || /referer|url|uri/i.test(key) ? REDACTED : value,
    ]),
  );
}
