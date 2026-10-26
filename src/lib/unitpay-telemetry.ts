/** Unitpay requires secretKey in API query strings; scrub automatic HTTP telemetry too. */
export function redactUnitpayTelemetry<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(/([?&]secretKey=)[^&#\s]*/gi, "$1[REDACTED]") as T;
  }
  if (Array.isArray(value)) return value.map(redactUnitpayTelemetry) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]: [string, unknown]) => [
        key,
        redactUnitpayTelemetry(item),
      ]),
    ) as T;
  }
  return value;
}
