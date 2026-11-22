import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins/email-otp";
import { telegram } from "better-auth-telegram";

import { env } from "~/env";
import {
  EMAIL_OTP_SIGN_IN_PATH,
  isAllowedAuthEmail,
  isEmailCodeAllowed,
} from "~/server/dashboard/emails";
import { db } from "~/server/db";
import { requestLocale } from "~/server/email/request-locale";
import {
  InvalidTelegramIdError,
  sanitizeAccountForPersist,
  sanitizeLoginWidgetUser,
  sanitizeMiniAppMappedUser,
  sanitizeUserForPersist,
} from "~/server/telegram/sanitize-mini-app-user";
import { syncChatMenuButton } from "~/server/telegram/menu-button";
import { MARKETING_ORIGIN } from "~/lib/public-url";
import {
  dashboardOrigin,
  FALLBACK_ORIGIN,
  marketingOrigin,
  miniappOrigin,
} from "~/server/urls";

const EMAIL_OTP_SEND_PATH = "/email-otp/send-verification-otp";

/** Email codes are for web buyers only, and only once Resend is configured. */
const emailCodeGuard = createAuthMiddleware(async (ctx) => {
  if (ctx.path !== EMAIL_OTP_SEND_PATH && ctx.path !== EMAIL_OTP_SIGN_IN_PATH) {
    return;
  }
  if (!env.RESEND_API_KEY) {
    throw new APIError("NOT_FOUND");
  }
  const body = ctx.body as { email?: unknown; type?: unknown } | undefined;
  const email = typeof body?.email === "string" ? body.email : undefined;
  if (!isEmailCodeAllowed(email)) {
    throw new APIError("FORBIDDEN", {
      message: "This email cannot sign in with a code.",
    });
  }
  if (ctx.path === EMAIL_OTP_SEND_PATH) {
    if (body?.type !== "sign-in") {
      throw new APIError("BAD_REQUEST");
    }
    // Loaded per request so importing auth stays cheap (build, tests).
    const { limitEmailCode } = await import("~/server/http/rate-limit");
    const limited = await limitEmailCode(email ?? "");
    if (limited) {
      throw new APIError(
        limited.status === 429 ? "TOO_MANY_REQUESTS" : "SERVICE_UNAVAILABLE",
      );
    }
  }
});

/** Display name for a buyer who registered by email: the address's local part. */
function emailDisplayName(email: string) {
  return email.split("@")[0] ?? "";
}

const createAuth = () =>
  betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: dashboardOrigin(),
    trustedOrigins: Array.from(
      new Set([
        dashboardOrigin(),
        miniappOrigin(),
        "https://dashboard.simverse.sh",
        "https://miniapp.simverse.sh",
        MARKETING_ORIGIN,
        marketingOrigin(),
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
    // Avoid a database session read on every mini-app navigation. Purchase bans
    // still read isBanned from Postgres.
    hooks: {
      before: emailCodeGuard,
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
        strategy: "compact",
      },
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
          before: async (user, ctx) => {
            if (!isAllowedAuthEmail(user.email, ctx?.path)) {
              throw new APIError("FORBIDDEN", {
                message: "This account is not allowed to sign in.",
              });
            }
            const byEmailCode = ctx?.path === EMAIL_OTP_SIGN_IN_PATH;
            try {
              return {
                data: sanitizeUserForPersist(
                  byEmailCode
                    ? {
                        ...user,
                        name: user.name || emailDisplayName(user.email),
                        preferredLanguage: requestLocale(ctx.headers),
                      }
                    : user,
                ),
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
          after: async (user) => {
            await syncChatMenuButton({
              telegramId: user.telegramId,
              preferredLanguage: user.preferredLanguage,
            });
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
        preferredLanguage: {
          type: "string",
          required: false,
          input: false,
        },
        dataUsageNotifications: {
          type: "boolean",
          required: false,
          defaultValue: true,
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
        // Website sign-in. BotFather /setdomain must point at the marketing host.
        loginWidget: true,
        mapTelegramDataToUser: (data) => {
          try {
            return sanitizeLoginWidgetUser(data);
          } catch (error) {
            if (error instanceof InvalidTelegramIdError) {
              throw new APIError("BAD_REQUEST", {
                message: "Invalid Telegram user id.",
              });
            }
            throw error;
          }
        },
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
      emailOTP({
        otpLength: 6,
        expiresIn: 10 * 60,
        allowedAttempts: 3,
        storeOTP: "hashed",
        sendVerificationOTP: async ({ email, otp, type }, ctx) => {
          if (type !== "sign-in") return;
          // React Email is heavy; load it only when a code is actually sent.
          const [{ signInCodeEmail }, { sendEmail }] = await Promise.all([
            import("~/server/email/templates"),
            import("~/server/email/send"),
          ]);
          const sent = await sendEmail({
            to: email,
            kind: "sign_in_code",
            ...signInCodeEmail(requestLocale(ctx?.headers), otp),
          });
          if (!sent) {
            throw new APIError("SERVICE_UNAVAILABLE");
          }
        },
      }),
      nextCookies(),
    ],
  });

type Auth = ReturnType<typeof createAuth>;
let auth: Auth | undefined;

/** Route collection must not initialize auth without runtime credentials. */
export function getAuth(): Auth {
  return (auth ??= createAuth());
}

export type Session = Auth["$Infer"]["Session"];
