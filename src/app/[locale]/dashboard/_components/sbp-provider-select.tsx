"use client";

import { useState } from "react";

import type { SbpProvider } from "~/server/sbp-provider";

import { setSbpProviderAction } from "../actions";

const PROVIDERS: { value: SbpProvider; label: string }[] = [
  { value: "xhub", label: "X-Hub" },
  { value: "platega", label: "Platega" },
];

export function SbpProviderSelect({
  initialProvider,
}: {
  initialProvider: SbpProvider;
}) {
  const [provider, setProvider] = useState(initialProvider);
  const [pending, setPending] = useState(false);

  return (
    <div className="flex items-center gap-4">
      <label
        htmlFor="sbp-provider"
        className="text-lg font-medium tracking-tight"
      >
        SBP Provider
      </label>
      <select
        id="sbp-provider"
        className="border-input bg-background h-10 rounded-md border px-3"
        value={provider}
        disabled={pending}
        onChange={(event) => {
          const previous = provider;
          const next = PROVIDERS.find(
            ({ value }) => value === event.target.value,
          )?.value;
          if (!next) return;
          setPending(true);
          setProvider(next);
          void setSbpProviderAction(next)
            .catch(() => {
              setProvider(previous);
            })
            .finally(() => {
              setPending(false);
            });
        }}
      >
        {PROVIDERS.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
