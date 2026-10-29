import { z } from "zod";
import type { TelegramMiniAppData } from "better-auth-telegram";

import {
  isWithinFirstTouchWindow,
  startParamFromInitData,
} from "~/lib/acquisition-source";
import { getAuth } from "~/server/better-auth";
import { db } from "~/server/db";
import { limitMiniappRequest } from "~/server/http/rate-limit";
import {
  openSourceForTelegramUser,
  registeredTrafficSourceCodes,
  storedFirstTouch,
} from "~/server/telegram/telegram-start";

const bodySchema = z.object({
  initData: z.string().min(1).max(16_384),
});

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

function attributed(source: string | null, openSource: string) {
  return Response.json({ source, openSource });
}

/**
 * Records the first Mini App open source for a new account. A `?start=` link
 * is remembered from the bot update. A signed `start_param` still counts.
 * A later open does not replace the stored source.
 */
export async function POST(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) {
    return unauthorized();
  }

  const limited = await limitMiniappRequest(session.user.id, "account");
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

  const validateMiniApp = getAuth().api.validateMiniApp as unknown as (input: {
    body: { initData: string };
  }) => Promise<{ valid: boolean; data: TelegramMiniAppData | null }>;

  const validation = await validateMiniApp({
    body: { initData: body.data.initData },
  });
  const telegramId = validation.valid ? validation.data?.user?.id : undefined;
  const sessionTelegramId = session.user.telegramId;
  if (
    !telegramId ||
    !sessionTelegramId ||
    String(telegramId) !== sessionTelegramId
  ) {
    return unauthorized();
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { acquisitionSource: true, createdAt: true },
  });
  if (!user) {
    return attributed(null, "organic");
  }

  const initParam = startParamFromInitData(body.data.initData);
  const allowed = await registeredTrafficSourceCodes();
  const { openSource, pendingFirst } = await openSourceForTelegramUser(
    sessionTelegramId,
    initParam,
    allowed,
  );
  if (user.acquisitionSource) {
    return attributed(user.acquisitionSource, openSource);
  }
  if (!isWithinFirstTouchWindow(user.createdAt)) {
    return attributed(null, openSource);
  }

  const source = storedFirstTouch(initParam, pendingFirst, allowed);
  const updated = await db.user.updateMany({
    where: { id: session.user.id, acquisitionSource: null },
    data: { acquisitionSource: source },
  });
  if (updated.count === 1) {
    return attributed(source, openSource);
  }

  const current = await db.user.findUnique({
    where: { id: session.user.id },
    select: { acquisitionSource: true },
  });
  return attributed(current?.acquisitionSource ?? null, openSource);
}
