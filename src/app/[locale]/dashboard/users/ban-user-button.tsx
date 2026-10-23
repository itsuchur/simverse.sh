"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "~/components/ui/button";
import { ReasonActionButton } from "../_components/reason-action-button";
import { setUserBanned } from "./actions";

export function BanUserButton({
  userId,
  isBanned,
}: {
  userId: string;
  isBanned: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!isBanned)
    return (
      <ReasonActionButton
        label="Ban"
        onSubmit={(reason) => setUserBanned(userId, true, reason)}
      />
    );
  return (
    <div>
      <Button
        type="button"
        size="lg"
        variant="outline"
        disabled={pending}
        onClick={() => {
          setPending(true);
          setError(null);
          void setUserBanned(userId, false)
            .then(() => router.refresh())
            .catch((err: unknown) =>
              setError(err instanceof Error ? err.message : "Unban failed"),
            )
            .finally(() => setPending(false));
        }}
      >
        {pending ? "Saving..." : "Unban"}
      </Button>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
