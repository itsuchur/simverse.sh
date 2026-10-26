const OMITTED_REGIONAL_COUNTRIES = new Set(["RU", "UA"]);

/** Unique country codes for coverage lists. */
export function displayedCountries(packages: { location: string }[]): string[] {
  const countries = new Set<string>();
  for (const pkg of packages) {
    const codes = pkg.location
      .split(",")
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean);
    for (const code of codes) {
      if (codes.length > 1 && OMITTED_REGIONAL_COUNTRIES.has(code)) continue;
      countries.add(code);
    }
  }
  return [...countries];
}
