"use client";

import { useState } from "react";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

import { setPriceModifierAction } from "../actions";

export function PriceModifierInput({
  initialValue,
}: {
  initialValue: number;
}) {
  const [value, setValue] = useState(String(initialValue));
  const [saved, setSaved] = useState(initialValue);
  const [pending, setPending] = useState(false);

  async function save() {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setValue(String(saved));
      return;
    }
    if (parsed === saved) return;

    setPending(true);
    try {
      await setPriceModifierAction(parsed);
      setSaved(parsed);
      setValue(String(parsed));
    } catch {
      setValue(String(saved));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-4">
        <label
          htmlFor="price-modifier"
          className="text-lg font-medium tracking-tight"
        >
          Price Modifier
        </label>
        <Input
          id="price-modifier"
          type="number"
          min="0.01"
          step="any"
          inputMode="decimal"
          className="w-28"
          value={value}
          disabled={pending}
          onChange={(event) => {
            setValue(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void save();
            }
          }}
        />
        <Button
          type="button"
          size="sm"
          disabled={pending}
          onClick={() => {
            void save();
          }}
        >
          Save
        </Button>
      </div>
      <p className="text-muted-foreground text-sm">
        Applied on the next poller catalog sync (startup or midnight).
      </p>
    </div>
  );
}
