import { z } from "zod";
import type { TelegramMiniAppData } from "better-auth-telegram";

import { auth } from "~/server/better-auth";
import { db } from "~/server/db";

const bodySchema = z.object({
  initData: z.string().min(1),
});

/**
 * Pre-sign-in consent check. Validates Telegram initData (HMAC, via the
 * better-auth-telegram validate endpoint) and reports whether the user must
 * accept the ToS/Privacy consent screen before signing in: either they have
 * never registered, or they previously deleted their account.
 */
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = bodySchema.safeParse(json);
  if (!body.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  // The plugin endpoint is loosely typed (optional, untyped body); narrow it.
  const validateMiniApp = auth.api.validateMiniApp as unknown as (input: {
    body: { initData: string };
  }) => Promise<{ valid: boolean; data: TelegramMiniAppData | null }>;

  const validation = await validateMiniApp({
    body: { initData: body.data.initData },
  });

  const telegramId = validation.valid ? validation.data?.user?.id : undefined;
  if (!telegramId) {
    return Response.json({ error: "Invalid initData" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { telegramId: String(telegramId) },
    select: { isDeleted: true },
  });

  return Response.json({ needsConsent: !user || user.isDeleted });
}
