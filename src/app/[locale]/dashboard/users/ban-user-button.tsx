"use client";

import { useState } from "react";

import { Button } from "~/components/ui/button";

import { toggleUserBanned } from "./actions";

export function BanUserButton({
  userId,
  isBanned,
}: {
  userId: string;
  isBanned: boolean;
}) {
  const [pending, setPending] = useState(false);

  return (
    <Button
      type="button"
      size="lg"
      className="h-10 px-4 text-base"
      variant={isBanned ? "outline" : "destructive"}
      disabled={pending}
      onClick={() => {
        setPending(true);
        void toggleUserBanned(userId).finally(() => {
          setPending(false);
        });
      }}
    >
      {pending ? "Saving…" : isBanned ? "Unban" : "Ban"}
    </Button>
  );
}
