import { z } from "zod";
import type { TelegramMiniAppData } from "better-auth-telegram";

import { getAuth } from "~/server/better-auth";
import { db } from "~/server/db";
import { limitPrecheckRequest } from "~/server/http/rate-limit";

const bodySchema = z.object({
  initData: z.string().min(1).max(16_384),
});

/** Validate Telegram identity before reporting whether restoration requires consent. */
export async function POST(request: Request) {
  const limited = await limitPrecheckRequest(request);
  if (limited) return limited;

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
  const validateMiniApp = getAuth().api.validateMiniApp as unknown as (input: {
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

  return Response.json(
    { requiresRestoration: user?.isDeleted === true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
