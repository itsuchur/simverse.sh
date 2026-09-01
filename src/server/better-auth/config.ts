import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { telegram } from "better-auth-telegram";

import { env } from "~/env";
import { isAllowedAuthEmail } from "~/server/dashboard/emails";
import { db } from "~/server/db";
import { dashboardOrigin, miniappOrigin } from "~/server/urls";

const fallbackAuthOrigin = "http://localhost:3000";

export const auth = betterAuth({
  // `SKIP_ENV_VALIDATION` Docker builds have no BETTER_AUTH_URL while Next
  // collects route config; Better Auth still calls `.replace` on baseURL.
  baseURL: dashboardOrigin() ?? fallbackAuthOrigin,
  trustedOrigins: Array.from(
    new Set(
      [dashboardOrigin(), miniappOrigin(), fallbackAuthOrigin].filter(
        (origin): origin is string => Boolean(origin),
      ),
    ),
  ),
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  // Google's redirect is a cross-site GET. Next.js often never persists the
  // short-lived OAuth state cookie, so the callback would fail with
  // `state_mismatch` even though the state row is in `verification`.
  account: {
    storeStateStrategy: "database",
    skipStateCookieCheck: true,
  },
  socialProviders:
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : undefined,
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          if (!isAllowedAuthEmail(user.email)) {
            throw new APIError("FORBIDDEN", {
              message: "This account is not allowed to sign in.",
            });
          }
        },
      },
    },
  },
  user: {
    additionalFields: {
      telegramId: {
        type: "string",
        required: false,
        input: false,
      },
      languageCode: {
        type: "string",
        required: false,
        input: false,
      },
      isPremium: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
      allowsWriteToPm: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
      fingerprint: {
        type: "string",
        required: false,
        input: false,
      },
      isBanned: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
  plugins: [
    telegram({
      botToken: env.TELEGRAM_BOT_TOKEN,
      botUsername: env.TELEGRAM_BOT_USERNAME,
      loginWidget: false,
      miniApp: {
        enabled: true,
        validateInitData: true,
        allowAutoSignin: true,
        mapMiniAppDataToUser: (user) => ({
          name: user.last_name
            ? `${user.first_name} ${user.last_name}`
            : user.first_name,
          image: user.photo_url,
          // Better Auth requires email; Telegram Mini App initData does not provide one.
          email: `${user.id}@telegram.local`,
          languageCode: user.language_code,
          isPremium: user.is_premium ?? false,
          allowsWriteToPm: user.allows_write_to_pm ?? false,
        }),
      },
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
