import type { CatalogCoverage } from "./catalog-types";
import { countryNameToIso } from "~/server/suppliers/esimfly/country-codes";

/** Keep carrier capabilities tied to their country; never infer them from plan speed. */
export function extractCoverage(
  locations: unknown[] | undefined,
  location: string,
): CatalogCoverage[] {
  const codes = location
    .split(",")
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
  const coverage = new Map<string, CatalogCoverage>();
  for (const entry of locations ?? []) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const code =
      typeof item.locationCode === "string"
        ? item.locationCode.trim().toUpperCase()
        : typeof item.locationName === "string"
          ? countryNameToIso(item.locationName)
          : undefined;
    const countryCode =
      code && codes.includes(code)
        ? code
        : codes.length === 1
          ? codes[0]
          : undefined;
    if (!countryCode) continue;
    const country = coverage.get(countryCode) ?? { countryCode, operators: [] };
    coverage.set(countryCode, country);
    for (const value of Array.isArray(item.operatorList)
      ? (item.operatorList as unknown[])
      : []) {
      if (!value || typeof value !== "object") continue;
      const operator = value as Record<string, unknown>;
      if (
        typeof operator.operatorName !== "string" ||
        !operator.operatorName.trim()
      )
        continue;
      const operatorName = operator.operatorName.trim();
      const networkTypes =
        typeof operator.networkType === "string"
          ? [
              ...new Set(
                operator.networkType
                  .toUpperCase()
                  .match(/\b(?:3G|4G|5G|LTE)\b/g) ?? [],
              ),
            ]
          : [];
      const existing = country.operators.find(
        (candidate) => candidate.operatorName === operatorName,
      );
      if (existing)
        existing.networkTypes = [
          ...new Set([...existing.networkTypes, ...networkTypes]),
        ];
      else country.operators.push({ operatorName, networkTypes });
    }
  }
  return [...coverage.values()];
}
