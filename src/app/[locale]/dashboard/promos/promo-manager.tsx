"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { ReasonActionButton } from "../_components/reason-action-button";
import { createPromoCodeAction, revokePromoCodeAction } from "./actions";

export type PromoRow = {
  id: string;
  code: string;
  discountPercent: number;
  oncePerUser: boolean;
  maxRedemptions: number | null;
  liveRedemptions: number;
  startsAt: string;
  endsAt: string | null;
  note: string | null;
  status: "Active" | "Scheduled" | "Expired" | "Revoked";
  revokeReason: string | null;
};

function datetimeLocalValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatWhen(value: string) {
  return new Date(value).toLocaleString();
}

export function PromoManager({ promos }: { promos: PromoRow[] }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [percent, setPercent] = useState("10");
  const [usage, setUsage] = useState<"once" | "unlimited">("once");
  const [cap, setCap] = useState("");
  const [startsAt, setStartsAt] = useState(datetimeLocalValue(new Date()));
  const [endsAt, setEndsAt] = useState("");
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createPromo() {
    const discountPercent = Number(percent);
    const maxRedemptions = cap.trim() === "" ? null : Number(cap);
    if (
      !Number.isInteger(discountPercent) ||
      discountPercent < 1 ||
      discountPercent > 99
    ) {
      setError("Enter a discount from 1 to 99.");
      return;
    }
    if (
      maxRedemptions != null &&
      (!Number.isInteger(maxRedemptions) || maxRedemptions < 1)
    ) {
      setError("Enter a total cap of at least 1, or leave it empty.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await createPromoCodeAction({
        code,
        discountPercent,
        oncePerUser: usage === "once",
        maxRedemptions,
        startsAt,
        endsAt: endsAt.trim() === "" ? null : endsAt,
        note: note.trim() === "" ? null : note,
      });
      setCode("");
      setNote("");
      setCap("");
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not create the promo code.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-8">
      <form
        className="grid max-w-3xl gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void createPromo();
        }}
      >
        <h2 className="text-xl font-medium">New promo code</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm font-medium">Code</span>
            <Input
              value={code}
              required
              maxLength={32}
              autoCapitalize="characters"
              spellCheck={false}
              className="uppercase"
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Discount percent</span>
            <Input
              type="number"
              min={1}
              max={99}
              required
              value={percent}
              onChange={(event) => setPercent(event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Usage</span>
            <select
              className="border-input h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm"
              value={usage}
              onChange={(event) =>
                setUsage(
                  event.target.value === "unlimited" ? "unlimited" : "once",
                )
              }
            >
              <option value="once">Once per user</option>
              <option value="unlimited">Unlimited per user</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Total cap</span>
            <Input
              type="number"
              min={1}
              value={cap}
              placeholder="No cap"
              onChange={(event) => setCap(event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Starts</span>
            <Input
              type="datetime-local"
              required
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm font-medium">Ends</span>
            <Input
              type="datetime-local"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
            />
          </label>
        </div>
        <label className="space-y-1">
          <span className="text-sm font-medium">Note</span>
          <textarea
            value={note}
            maxLength={500}
            onChange={(event) => setNote(event.target.value)}
            className="border-input min-h-20 w-full rounded-lg border p-3"
          />
        </label>
        {error ? <p className="text-destructive text-sm">{error}</p> : null}
        <Button type="submit" disabled={pending} className="w-fit">
          {pending ? "Saving..." : "Add promo code"}
        </Button>
      </form>

      <div className="space-y-3">
        {promos.length === 0 ? (
          <p className="text-muted-foreground">No promo codes yet.</p>
        ) : (
          promos.map((promo) => (
            <article
              key={promo.id}
              className="ring-foreground/10 space-y-2 rounded-xl p-4 ring-1"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h3 className="text-lg font-semibold tracking-wide">
                  {promo.code}
                </h3>
                <p className="text-sm">{promo.status}</p>
              </div>
              <p>
                {promo.discountPercent}% ·{" "}
                {promo.oncePerUser ? "Once per user" : "Unlimited per user"} ·{" "}
                {promo.liveRedemptions}
                {promo.maxRedemptions == null
                  ? ""
                  : ` / ${promo.maxRedemptions}`}{" "}
                live
              </p>
              <p className="text-muted-foreground text-sm">
                {formatWhen(promo.startsAt)}
                {promo.endsAt ? ` – ${formatWhen(promo.endsAt)}` : " – no end"}
              </p>
              {promo.note ? <p className="text-sm">{promo.note}</p> : null}
              {promo.revokeReason ? (
                <p className="text-sm">Revoke reason: {promo.revokeReason}</p>
              ) : (
                <ReasonActionButton
                  label="Revoke"
                  onSubmit={(reason) => revokePromoCodeAction(promo.id, reason)}
                />
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
