"use client";

import { useState } from "react";

import { Button } from "~/components/ui/button";
import { useRouter } from "~/i18n/navigation";
import { authClient, signInWithGoogle } from "~/lib/auth-client";

export function DashboardSignIn({
  hasWrongAccount,
  googleConfigured,
}: {
  hasWrongAccount: boolean;
  googleConfigured: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 px-8">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground text-base">
        Sign in with Google using the support account to continue.
      </p>
      {hasWrongAccount ? (
        <p className="text-destructive text-base">
          This account cannot access the dashboard. Sign out and try again with
          support@simverse.sh.
        </p>
      ) : null}
      {error ? <p className="text-destructive text-base">{error}</p> : null}
      {!googleConfigured ? (
        <p className="text-muted-foreground text-base">
          Google OAuth is not configured on this server.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          size="lg"
          className="h-11 px-5 text-base"
          disabled={!googleConfigured || pending}
          onClick={() => {
            setPending(true);
            setError(null);
            void signInWithGoogle()
              .then((result) => {
                if (result.error) {
                  setError(
                    result.error.message ?? "Google sign-in failed. Try again.",
                  );
                  setPending(false);
                }
              })
              .catch((err: unknown) => {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Google sign-in failed. Try again.",
                );
                setPending(false);
              });
          }}
        >
          {pending ? "Redirecting…" : "Sign in with Google"}
        </Button>
        {hasWrongAccount ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-11 px-5 text-base"
            disabled={pending}
            onClick={() => {
              setPending(true);
              void authClient.signOut().then(() => {
                router.refresh();
              });
            }}
          >
            Sign out
          </Button>
        ) : null}
      </div>
    </main>
  );
}
