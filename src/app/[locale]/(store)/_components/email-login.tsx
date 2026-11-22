"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { sendEmailSignInCode, signInWithEmailCode } from "~/lib/auth-client";

type ErrorKey =
  | "emailInvalid"
  | "emailNotAllowed"
  | "emailCodeInvalid"
  | "emailRateLimited"
  | "loginFailed";

function errorKey(status: number | undefined, fallback: ErrorKey): ErrorKey {
  if (status === 429) return "emailRateLimited";
  if (status === 403) return "emailNotAllowed";
  return fallback;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email + 6-digit code sign-in. The account is created on first sign-in. */
export function EmailLogin({ onSignedIn }: { onSignedIn: () => void }) {
  const t = useTranslations("Store");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);

  async function sendCode() {
    const normalized = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      setError("emailInvalid");
      return;
    }
    setPending(true);
    setError(null);
    const result = await sendEmailSignInCode(normalized).catch(() => null);
    setPending(false);
    if (!result || result.error) {
      setError(errorKey(result?.error?.status, "loginFailed"));
      return;
    }
    setEmail(normalized);
    setCode("");
    setCodeSent(true);
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await signInWithEmailCode(email, code.trim()).catch(
      () => null,
    );
    setPending(false);
    if (!result || result.error) {
      setError(
        errorKey(
          result?.error?.status,
          result ? "emailCodeInvalid" : "loginFailed",
        ),
      );
      return;
    }
    onSignedIn();
  }

  return (
    <div className="flex flex-col gap-3">
      {codeSent ? (
        <form className="flex flex-col gap-3" onSubmit={(e) => void verify(e)}>
          <p className="text-muted-foreground text-sm leading-6">
            {t("emailCodeSent", { email })}
          </p>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("emailCodeLabel")}
            <Input
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              autoFocus
              className="text-center font-mono text-lg tracking-[0.4em]"
            />
          </label>
          <Button type="submit" disabled={pending || code.length !== 6}>
            {t("emailVerify")}
          </Button>
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <button
              type="button"
              className="text-muted-foreground underline-offset-4 hover:underline"
              disabled={pending}
              onClick={() => void sendCode()}
            >
              {t("emailResend")}
            </button>
            <button
              type="button"
              className="text-muted-foreground underline-offset-4 hover:underline"
              disabled={pending}
              onClick={() => {
                setCodeSent(false);
                setError(null);
              }}
            >
              {t("emailChange")}
            </button>
          </div>
        </form>
      ) : (
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void sendCode();
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {t("emailLabel")}
            <Input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("emailPlaceholder")}
              autoComplete="email"
              required
            />
          </label>
          <Button type="submit" variant="outline" disabled={pending}>
            {t("emailSendCode")}
          </Button>
        </form>
      )}
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {t(error)}
        </p>
      ) : null}
    </div>
  );
}
