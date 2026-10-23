"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "~/components/ui/dialog";

export function ReasonActionButton({
  label,
  onSubmit,
  initialReason = "",
}: {
  label: "Refund" | "Ban";
  initialReason?: string;
  onSubmit: (reason: string) => Promise<{ pending: boolean } | void>;
}) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Button
        type="button"
        size="lg"
        variant="destructive"
        onClick={() => {
          setReason(initialReason);
          setError(null);
          setOpen(true);
        }}
      >
        {label}
      </Button>
      {message && (
        <p role="status" className="text-muted-foreground mt-1 text-sm">
          {message}
        </p>
      )}
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
      >
        <DialogContent showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>
              {label === "Refund" ? "Refund order" : "Ban user"}
            </DialogTitle>
            <DialogDescription>
              Enter a reason and submit to {label.toLowerCase()}. Closing this
              form cancels the action.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (pending || !reason.trim()) return;
              setPending(true);
              setError(null);
              void onSubmit(reason.trim())
                .then((result) => {
                  setMessage(
                    result?.pending
                      ? "Refund requested; awaiting X-Hub confirmation."
                      : `${label === "Refund" ? "Refund" : "Ban"} completed.`,
                  );
                  setOpen(false);
                  router.refresh();
                })
                .catch((err: unknown) =>
                  setError(
                    err instanceof Error ? err.message : `${label} failed`,
                  ),
                )
                .finally(() => setPending(false));
            }}
          >
            <label htmlFor={id} className="block text-sm font-medium">
              {label} reason
            </label>
            <textarea
              id={id}
              required
              maxLength={500}
              value={reason}
              disabled={pending}
              onChange={(event) => setReason(event.target.value)}
              className="border-input min-h-28 w-full rounded-md border p-3"
            />
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={pending || !reason.trim()}
              >
                {pending ? "Submitting..." : `Confirm ${label.toLowerCase()}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
