import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    BETTER_AUTH_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string()
        : z.string().optional(),
    BETTER_AUTH_URL: z.string().url(),
    MINIAPP_URL: z.string().url().optional(),
    API_URL: z.string().url().optional(),
    TELEGRAM_BOT_TOKEN: z.string().min(1),
    TELEGRAM_BOT_USERNAME: z.string().min(1),
    TELEGRAM_WEBHOOK_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string().min(16)
        : z.string().min(16).optional(),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    ESIMACCESS_ACCESS_CODE: z.string().min(1),
    // Shared secret embedded in the webhook URL registered with eSIM Access
    // (their webhooks are not signed, so the URL token is the auth mechanism).
    ESIMACCESS_WEBHOOK_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string().min(16)
        : z.string().min(16).optional(),
    CRYPTOMUS_MERCHANT_ID:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().min(1).optional(),
    CRYPTOMUS_API_KEY:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().min(1).optional(),
    CARDLINK_API_TOKEN:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().min(1).optional(),
    CARDLINK_SHOP_ID:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().min(1).optional(),
    GOOGLE_CLIENT_ID:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().min(1).optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().optional(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    MINIAPP_URL: process.env.MINIAPP_URL,
    API_URL: process.env.API_URL,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME,
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    ESIMACCESS_ACCESS_CODE: process.env.ESIMACCESS_ACCESS_CODE,
    ESIMACCESS_WEBHOOK_SECRET: process.env.ESIMACCESS_WEBHOOK_SECRET,
    CRYPTOMUS_MERCHANT_ID: process.env.CRYPTOMUS_MERCHANT_ID,
    CRYPTOMUS_API_KEY: process.env.CRYPTOMUS_API_KEY,
    CARDLINK_API_TOKEN: process.env.CARDLINK_API_TOKEN,
    CARDLINK_SHOP_ID: process.env.CARDLINK_SHOP_ID,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
