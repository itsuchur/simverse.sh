import { createAuthClient } from "better-auth/react";
import { telegramClient } from "better-auth-telegram/client";

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.BETTER_AUTH_URL,
  fetchOptions: {
    credentials: "include",
    headers:
      process.env.NODE_ENV === "development"
        ? {
            // Free ngrok serves an interstitial HTML page unless this header
            // is present.
            "ngrok-skip-browser-warning": "true",
          }
        : undefined,
  },
  plugins: [telegramClient()],
});

export type Session = typeof authClient.$Infer.Session;

type TelegramMiniAppSignInResult =
  | { data: unknown; error: null }
  | {
      data: null;
      error: {
        message?: string;
        status: number;
        statusText: string;
      };
    };

/**
 * Typed facade around the Telegram plugin action.
 * Better Auth's plugin inference can resolve to an ESLint `error` type
 * under projectService, which trips no-unsafe-* on direct calls.
 */
export async function signInWithGoogle() {
  const result = await authClient.signIn.social({
    provider: "google",
    callbackURL: "/dashboard",
    disableRedirect: true,
  });
  if (result.data?.url) {
    window.location.assign(result.data.url);
  }
  return result;
}

export function autoSignInFromMiniApp(): Promise<TelegramMiniAppSignInResult> {
  const client = authClient as unknown as {
    autoSignInFromMiniApp: () => Promise<TelegramMiniAppSignInResult>;
  };
  return client.autoSignInFromMiniApp();
}
