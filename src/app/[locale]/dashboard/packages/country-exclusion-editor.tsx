"use client";

import { useMemo, useState } from "react";
import ReactCountryFlag from "react-country-flag";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

import { excludeCountryCodeAction, restoreCountryCodeAction } from "./actions";

export type CountryEntry = {
  code: string;
  name: string;
};

export function CountryExclusionEditor({
  excluded,
  available,
}: {
  excluded: CountryEntry[];
  available: CountryEntry[];
}) {
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");

  const excludedCodes = useMemo(
    () => new Set(excluded.map((country) => country.code)),
    [excluded],
  );

  const candidates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return [];
    }
    return available.filter(
      (country) =>
        !excludedCodes.has(country.code) &&
        (country.code.toLowerCase().includes(normalizedQuery) ||
          country.name.toLowerCase().includes(normalizedQuery)),
    );
  }, [available, query, excludedCodes]);

  async function run(action: (code: string) => Promise<void>, code: string) {
    setPending(true);
    try {
      await action(code);
      setQuery("");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      {excluded.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No countries are excluded.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {excluded.map((country) => (
            <div
              key={country.code}
              className="bg-muted flex items-center gap-3 rounded-lg px-3 py-2"
            >
              <ReactCountryFlag
                countryCode={country.code}
                svg
                style={{
                  width: "1.25em",
                  height: "1.25em",
                  flexShrink: 0,
                  display: "block",
                }}
                aria-hidden
              />
              <span className="text-sm">{country.name}</span>
              <code className="text-muted-foreground text-xs">
                {country.code}
              </code>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="whitespace-nowrap"
                disabled={pending}
                onClick={() => {
                  void run(restoreCountryCodeAction, country.code);
                }}
              >
                Restore
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-xl space-y-2">
        <label
          htmlFor="exclude-country-search"
          className="text-sm font-medium"
        >
          Exclude country
        </label>
        <Input
          id="exclude-country-search"
          type="search"
          placeholder="Search by name or code…"
          value={query}
          disabled={pending}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
        {candidates.length > 0 ? (
          <ul className="ring-foreground/10 max-h-48 divide-y overflow-y-auto rounded-xl ring-1">
            {candidates.slice(0, 20).map((country) => (
              <li key={country.code}>
                <button
                  type="button"
                  disabled={pending}
                  className="hover:bg-muted flex w-full items-center gap-3 px-3 py-2 text-left disabled:opacity-50"
                  onClick={() => {
                    void run(excludeCountryCodeAction, country.code);
                  }}
                >
                  <ReactCountryFlag
                    countryCode={country.code}
                    svg
                    style={{
                      width: "1.25em",
                      height: "1.25em",
                      flexShrink: 0,
                      display: "block",
                    }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1 truncate">{country.name}</span>
                  <span className="text-muted-foreground text-xs">
                    {country.code}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : query.trim() ? (
          <p className="text-muted-foreground text-sm">No matching countries.</p>
        ) : null}
      </div>
    </div>
  );
}
