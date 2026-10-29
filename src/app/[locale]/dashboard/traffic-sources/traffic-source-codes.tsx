"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";

import { addTrafficSourceCode, removeTrafficSourceCode } from "./actions";

export function TrafficSourceCodes({ codes }: { codes: string[] }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addCode() {
    setPending(true);
    setError(null);
    try {
      await addTrafficSourceCode(code);
      setCode("");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Could not add that code.",
      );
    } finally {
      setPending(false);
    }
  }

  async function removeCode(value: string) {
    setPending(true);
    setError(null);
    try {
      await removeTrafficSourceCode(value);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not remove that code.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-medium">Registered codes</h2>
      <p className="text-muted-foreground max-w-2xl text-sm">
        A plain /start is organic. Any other payload is unknown until you
        register its code. Removing a code leaves old clicks unchanged.
      </p>
      <form
        className="flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          void addCode();
        }}
      >
        <label className="min-w-0 flex-1 space-y-1">
          <span className="text-sm font-medium">Code</span>
          <Input
            value={code}
            required
            maxLength={64}
            spellCheck={false}
            placeholder="src_tg_ads"
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        <Button type="submit" size="lg" className="h-10" disabled={pending}>
          Add code
        </Button>
      </form>
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
      {codes.length === 0 ? (
        <p className="text-muted-foreground text-sm">No codes yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {codes.map((value) => (
            <li
              key={value}
              className="ring-foreground/10 flex items-center gap-2 rounded-lg px-3 py-1.5 ring-1"
            >
              <span className="font-mono text-sm">{value}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => {
                  void removeCode(value);
                }}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
