import "server-only";

import * as Sentry from "@sentry/nextjs";
import type { ReactElement } from "react";
import type { Resend } from "resend";

import { env } from "~/env";

let client: Resend | undefined;

/** Email sign-in and buyer emails stay off until Resend is configured. */
export function isEmailConfigured() {
  return Boolean(env.RESEND_API_KEY);
}

/** Send one transactional email. Never rejects; returns whether Resend accepted it. */
export async function sendEmail(input: {
  to: string;
  subject: string;
  react: ReactElement;
  /** Sentry tag for the kind of email, e.g. `esim_delivery`. */
  kind: string;
}): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  try {
    // Loaded on first send: Resend is heavy and most requests never email.
    client ??= new (await import("resend")).Resend(env.RESEND_API_KEY);
    const { error } = await client.emails.send({
      from: env.EMAIL_FROM,
      to: input.to,
      subject: input.subject,
      react: input.react,
    });
    if (!error) return true;
    Sentry.captureMessage("Resend rejected an email", {
      level: "error",
      tags: { component: "email", reason: `${input.kind}_failed` },
      extra: { name: error.name, message: error.message },
    });
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: "email", reason: `${input.kind}_failed` },
    });
  }
  return false;
}
