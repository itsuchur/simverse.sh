import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { telegram } from "better-auth-telegram";

import { env } from "~/env";
import { isAllowedAuthEmail } from "~/server/dashboard/emails";
import { db } from "~/server/db";
import {
  InvalidTelegramIdError,
  sanitizeAccountForPersist,
  sanitizeMiniAppMappedUser,
  sanitizeUserForPersist,
} from "~/server/telegram/sanitize-mini-app-user";
import { dashboardOrigin, FALLBACK_ORIGIN, miniappOrigin } from "~/server/urls";

export const auth = betterAuth({
  // Docker `next build` has no BETTER_AUTH_URL; origin helpers fall back so
  // Better Auth can still evaluate `.replace` during route collection.
  baseURL: dashboardOrigin(),
  trustedOrigins: Array.from(
    new Set([
      dashboardOrigin(),
      miniappOrigin(),
      "https://dashboard.simverse.sh",
      "https://miniapp.simverse.sh",
      FALLBACK_ORIGIN,
    ]),
  ),
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  // Traefik sets X-Real-Ip on forwarded requests; Better Auth needs this for
  // per-client rate limiting and session IP tracking behind the proxy.
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["x-real-ip"],
    },
  },
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
          try {
            return {
              data: sanitizeUserForPersist(user),
            };
          } catch (error) {
            if (error instanceof InvalidTelegramIdError) {
              throw new APIError("BAD_REQUEST", {
                message: "Invalid Telegram user id.",
              });
            }
            throw error;
          }
        },
      },
    },
    account: {
      create: {
        before: async (account) => {
          try {
            return {
              data: sanitizeAccountForPersist(account),
            };
          } catch (error) {
            if (error instanceof InvalidTelegramIdError) {
              throw new APIError("BAD_REQUEST", {
                message: "Invalid Telegram user id.",
              });
            }
            throw error;
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
        mapMiniAppDataToUser: (user) => {
          try {
            return sanitizeMiniAppMappedUser(user);
          } catch (error) {
            if (error instanceof InvalidTelegramIdError) {
              throw new APIError("BAD_REQUEST", {
                message: "Invalid Telegram user id.",
              });
            }
            throw error;
          }
        },
      },
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
