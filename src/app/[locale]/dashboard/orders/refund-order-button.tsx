"use client";

import { useState } from "react";

import { Button } from "~/components/ui/button";

import { refundPlategaOrder } from "./actions";

export function RefundOrderButton({ orderUuid }: { orderUuid: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        size="lg"
        className="h-10 px-4 text-base"
        variant="destructive"
        disabled={pending}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setPending(true);
          setError(null);
          void refundPlategaOrder(orderUuid)
            .catch((err: unknown) => {
              setError(
                err instanceof Error ? err.message : "Refund failed",
              );
            })
            .finally(() => {
              setPending(false);
            });
        }}
      >
        {pending ? "Refunding…" : "Refund"}
      </Button>
      {error ? (
        <p className="max-w-56 text-sm text-red-600 break-words">{error}</p>
      ) : null}
    </div>
  );
}
