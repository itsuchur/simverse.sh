/** URL slug for a country page, from its English name: `TR` → `turkey`. */
export function countrySlug(countryCode: string): string {
  const code = countryCode.toUpperCase();
  let name = code;
  try {
    name = new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    name = code;
  }
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Country code whose slug matches, among the codes that have a page. */
export function countryCodeForSlug(
  slug: string,
  countryCodes: readonly string[],
): string | undefined {
  return countryCodes.find((code) => countrySlug(code) === slug);
}
