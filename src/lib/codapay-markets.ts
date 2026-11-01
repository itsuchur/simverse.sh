import { z } from "zod";

// Markets with at least one enabled method in the supplied sandbox portal list.
// This is a payment-method allowlist, not a guarantee of card availability.
export const CODAPAY_COUNTRIES = [
  "AR",
  "AU",
  "AT",
  "BH",
  "BD",
  "BE",
  "BO",
  "BR",
  "KH",
  "CA",
  "CL",
  "CO",
  "CZ",
  "DK",
  "EC",
  "EG",
  "FI",
  "FR",
  "DE",
  "GR",
  "GT",
  "HK",
  "HU",
  "IN",
  "ID",
  "IL",
  "IT",
  "JP",
  "KZ",
  "KE",
  "KW",
  "LA",
  "MY",
  "MX",
  "MN",
  "MA",
  "MM",
  "NL",
  "NZ",
  "NG",
  "NO",
  "PK",
  "PS",
  "PY",
  "PE",
  "PH",
  "PL",
  "PT",
  "PR",
  "QA",
  "IE",
  "RO",
  "SA",
  "SG",
  "SK",
  "ZA",
  "KR",
  "ES",
  "LK",
  "SE",
  "CH",
  "TW",
  "TH",
  "TR",
  "AE",
  "GB",
  "US",
  "UY",
  "VN",
] as const;

export const codapayCountrySchema = z.enum(CODAPAY_COUNTRIES);
export type CodapayCountry = z.infer<typeof codapayCountrySchema>;

export function detectedCodapayCountry(
  headers: Pick<Headers, "get">,
): CodapayCountry | null {
  // Cloudflare overwrites this header. Production ingress must prevent direct
  // origin access and preserve the edge header. Do not infer market from language.
  const parsed = codapayCountrySchema.safeParse(
    headers.get("cf-ipcountry")?.trim().toUpperCase(),
  );
  return parsed.success ? parsed.data : null;
}
