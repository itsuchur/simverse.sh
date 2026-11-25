"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Search } from "lucide-react";

import { Input } from "~/components/ui/input";
import { Link } from "~/i18n/navigation";

import { FlagBadge } from "./flag-badge";

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
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2" />
        <Input
          id="country-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder}
          autoComplete="off"
          className="h-14 rounded-xl pl-12 text-lg shadow-sm md:text-lg"
        />
      </div>
      {visible.length === 0 ? (
        <p className="text-muted-foreground text-lg">{noMatches}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {visible.map((country) => (
            <li key={country.code}>
              <Link
                href={`/esim/${country.slug}`}
                className="group border-border bg-card hover:border-foreground/25 flex items-center gap-4 rounded-xl border px-4 py-4 shadow-sm transition-all hover:shadow-md sm:px-5"
              >
                <FlagBadge countryCode={country.code} height="1.5rem" />
                <span className="min-w-0 flex-1 text-base font-semibold sm:text-lg">
                  {country.name}
                </span>
                {country.fromPrice ? (
                  <span className="text-base font-semibold whitespace-nowrap">
                    {country.fromPrice}
                  </span>
                ) : null}
                <ChevronRight
                  className="text-muted-foreground group-hover:text-foreground size-5 shrink-0 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
