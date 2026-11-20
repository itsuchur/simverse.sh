"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import ReactCountryFlag from "react-country-flag";

import { Input } from "~/components/ui/input";
import { Link } from "~/i18n/navigation";

export type CountryEntry = {
  code: string;
  name: string;
  slug: string;
  /** Already formatted, e.g. "from $4". */
  fromPrice: string | null;
};

/** Searchable A–Z list of countries, each linking to its price page. */
export function CountryDirectory({
  countries,
  searchLabel,
  searchPlaceholder,
  noMatches,
}: {
  countries: CountryEntry[];
  searchLabel: string;
  searchPlaceholder: string;
  noMatches: string;
}) {
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return countries;
    return countries.filter(
      (country) =>
        country.name.toLocaleLowerCase().includes(needle) ||
        country.code.toLowerCase() === needle,
    );
  }, [countries, query]);

  return (
    <div className="space-y-4">
      <label htmlFor="country-search" className="sr-only">
        {searchLabel}
      </label>
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          id="country-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          autoComplete="off"
          className="h-11 pl-9"
        />
      </div>
      {visible.length === 0 ? (
        <p className="text-muted-foreground">{noMatches}</p>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {visible.map((country) => (
            <li key={country.code}>
              <Link
                href={`/esim/${country.slug}`}
                className="hover:bg-muted/60 border-border flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors"
              >
                <ReactCountryFlag
                  countryCode={country.code}
                  svg
                  style={{ width: "1.5em", height: "1.5em", flexShrink: 0 }}
                  aria-hidden
                />
                <span className="min-w-0 flex-1 font-medium">
                  {country.name}
                </span>
                {country.fromPrice ? (
                  <span className="text-muted-foreground text-sm whitespace-nowrap">
                    {country.fromPrice}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
