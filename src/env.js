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
    BLOG_URL: z.string().url().optional(),
    STRAPI_URL:
      process.env.NODE_ENV === "production"
        ? z.string().url()
        : z.string().url().optional(),
    STRAPI_API_TOKEN: z.string().min(1).optional(),
    TELEGRAM_BOT_TOKEN: z.string().min(1),
    TELEGRAM_BOT_USERNAME: z.string().min(1),
    TELEGRAM_WEBHOOK_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string().min(16)
        : z.string().min(16).optional(),
    DATABASE_URL: z.string().url(),
    REDIS_URL: z.string().url(),
    ESIMACCESS_ACCESS_CODE: z.string().min(1),
    ESIMACCESS_WEBHOOK_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string().min(16)
        : z.string().min(16).optional(),
    // eSIMfly Business API (second catalog supplier). Optional: the poller
    // skips the eSIMfly sync when either is missing.
    ESIMFLY_ACCESS_CODE: z.string().min(1).optional(),
    ESIMFLY_SECRET_KEY: z.string().min(1).optional(),
    TRYBIT_API_KEY:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().min(1).optional(),
    TRYBIT_SHOP_ID:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().min(1).optional(),
    TRYBIT_SECRET_KEY:
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
    PAYPAL_CLIENT_ID: z.string().min(1).optional(),
    PAYPAL_CLIENT_SECRET: z.string().min(1).optional(),
    PAYPAL_WEBHOOK_ID: z.string().min(1).optional(),
    PAYPAL_ENVIRONMENT: z.enum(["sandbox", "production"]).default("sandbox"),
    UNITPAY_PROJECT_ID: z.string().regex(/^\d+$/).optional(),
    UNITPAY_SECRET_KEY: z.string().min(1).optional(),
    // Optional until Cent checkout is enabled; gated by centConfigured().
    CENT_API_TOKEN: z.string().min(1).optional(),
    CENT_SHOP_ID: z.string().min(1).optional(),
    PLATEGA_MERCHANT_ID:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().min(1).optional(),
    PLATEGA_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().min(1).optional(),
    XHUB_API_KEY:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().min(1).optional(),
    XHUB_API_SECRET:
      process.env.NODE_ENV === "production"
        ? z.string().min(1)
        : z.string().min(1).optional(),
    XHUB_WEBHOOK_SECRET:
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
    BLOG_URL: process.env.BLOG_URL,
    STRAPI_URL: process.env.STRAPI_URL,
    STRAPI_API_TOKEN: process.env.STRAPI_API_TOKEN,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_BOT_USERNAME: process.env.TELEGRAM_BOT_USERNAME,
    TELEGRAM_WEBHOOK_SECRET: process.env.TELEGRAM_WEBHOOK_SECRET,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    ESIMACCESS_ACCESS_CODE: process.env.ESIMACCESS_ACCESS_CODE,
    ESIMACCESS_WEBHOOK_SECRET: process.env.ESIMACCESS_WEBHOOK_SECRET,
    ESIMFLY_ACCESS_CODE: process.env.ESIMFLY_ACCESS_CODE,
    ESIMFLY_SECRET_KEY: process.env.ESIMFLY_SECRET_KEY,
    TRYBIT_API_KEY: process.env.TRYBIT_API_KEY,
    TRYBIT_SHOP_ID: process.env.TRYBIT_SHOP_ID,
    TRYBIT_SECRET_KEY: process.env.TRYBIT_SECRET_KEY,
    CARDLINK_API_TOKEN: process.env.CARDLINK_API_TOKEN,
    CARDLINK_SHOP_ID: process.env.CARDLINK_SHOP_ID,
    PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID,
    PAYPAL_CLIENT_SECRET: process.env.PAYPAL_CLIENT_SECRET,
    PAYPAL_WEBHOOK_ID: process.env.PAYPAL_WEBHOOK_ID,
    PAYPAL_ENVIRONMENT: process.env.PAYPAL_ENVIRONMENT,
    UNITPAY_PROJECT_ID: process.env.UNITPAY_PROJECT_ID,
    UNITPAY_SECRET_KEY: process.env.UNITPAY_SECRET_KEY,
    CENT_API_TOKEN: process.env.CENT_API_TOKEN,
    CENT_SHOP_ID: process.env.CENT_SHOP_ID,
    PLATEGA_MERCHANT_ID: process.env.PLATEGA_MERCHANT_ID,
    PLATEGA_SECRET: process.env.PLATEGA_SECRET,
    XHUB_API_KEY: process.env.XHUB_API_KEY,
    XHUB_API_SECRET: process.env.XHUB_API_SECRET,
    XHUB_WEBHOOK_SECRET: process.env.XHUB_WEBHOOK_SECRET,
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
  skipValidation: process.env.SKIP_ENV_VALIDATION === "1",
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});
