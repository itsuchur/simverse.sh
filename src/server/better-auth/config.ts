import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { telegram } from "better-auth-telegram";

import { env } from "~/env";
import { db } from "~/server/db";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: [env.BETTER_AUTH_URL],
  database: prismaAdapter(db, {
    provider: "postgresql",
  }),
  user: {
    additionalFields: {
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
  ],
});

export type Session = typeof auth.$Infer.Session;
