"use client";

import { useMemo, useState } from "react";
import ReactCountryFlag from "react-country-flag";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

import { setPopularCountriesAction } from "../actions";

type CountryEntry = {
  code: string;
  name: string;
};

export function PopularCountriesEditor({
  initialCountries,
  availableCountries,
}: {
  initialCountries: CountryEntry[];
  availableCountries: CountryEntry[];
}) {
  const [countries, setCountries] = useState(initialCountries);
  const [pending, setPending] = useState(false);
  const [query, setQuery] = useState("");

  const selectedCodes = useMemo(
    () => new Set(countries.map((country) => country.code)),
    [countries],
  );

  const addCandidates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return availableCountries.filter((country) => {
      if (selectedCodes.has(country.code)) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      return (
        country.code.toLowerCase().includes(normalizedQuery) ||
        country.name.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [availableCountries, query, selectedCodes]);

  async function persist(next: CountryEntry[]) {
    const previous = countries;
    setCountries(next);
    setPending(true);

    try {
      await setPopularCountriesAction(next.map((country) => country.code));
    } catch {
      setCountries(previous);
    } finally {
      setPending(false);
    }
  }

  function moveCountry(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= countries.length) {
      return;
    }

    const next = [...countries];
    [next[index], next[target]] = [next[target]!, next[index]!];
    void persist(next);
  }

  function removeCountry(index: number) {
    void persist(countries.filter((_, i) => i !== index));
  }

  function addCountry(country: CountryEntry) {
    void persist([...countries, country]);
    setQuery("");
  }

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-medium tracking-tight">Popular Countries</h2>

      {countries.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No popular countries configured. Add countries below to show them in
          the app catalog&apos;s Popular tab.
        </p>
      ) : (
        <ul className="ring-foreground/10 divide-foreground/10 divide-y overflow-hidden rounded-xl ring-1">
          {countries.map((country, index) => (
            <li
              key={country.code}
              className="bg-background flex items-center gap-3 px-3 py-2"
            >
              <ReactCountryFlag
                countryCode={country.code}
                svg
                style={{
                  width: "1.5em",
                  height: "1.5em",
                  flexShrink: 0,
                  display: "block",
                }}
                aria-label={country.name}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{country.name}</div>
                <div className="text-muted-foreground text-xs">
                  {country.code}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={pending || index === 0}
                  aria-label={`Move ${country.name} up`}
                  onClick={() => {
                    moveCountry(index, -1);
                  }}
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  disabled={pending || index === countries.length - 1}
                  aria-label={`Move ${country.name} down`}
                  onClick={() => {
                    moveCountry(index, 1);
                  }}
                >
                  ↓
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={pending}
                  onClick={() => {
                    removeCountry(index);
                  }}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <label htmlFor="popular-country-search" className="text-sm font-medium">
          Add country
        </label>
        <Input
          id="popular-country-search"
          type="search"
          placeholder="Search by name or code…"
          value={query}
          disabled={pending}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
        {addCandidates.length > 0 ? (
          <ul className="ring-foreground/10 max-h-48 divide-y overflow-y-auto rounded-xl ring-1">
            {addCandidates.slice(0, 20).map((country) => (
              <li key={country.code}>
                <button
                  type="button"
                  disabled={pending}
                  className="hover:bg-muted flex w-full items-center gap-3 px-3 py-2 text-left disabled:opacity-50"
                  onClick={() => {
                    addCountry(country);
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
    </section>
  );
}
