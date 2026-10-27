import "server-only";

import {
  classifyStartParam,
  firstTouchSource,
  startPayloadSource,
} from "~/lib/acquisition-source";
import { db } from "~/server/db";

/** Remember a `/start` payload. The first one sticks; later ones update latest. */
export async function rememberTelegramStart(
  telegramId: string,
  payload: string,
) {
  const source = startPayloadSource(payload);
  if (!source) {
    return;
  }
  await db.telegramStart.upsert({
    where: { telegramId },
    create: {
      telegramId,
      firstSource: source,
      latestSource: source,
    },
    update: { latestSource: source },
  });
}

/**
 * Source of this Mini App open. A signed `start_param` wins. Otherwise the
 * latest unused `/start` payload is consumed. Payment params are not visits.
 */
export async function openSourceForTelegramUser(
  telegramId: string,
  initParam: string | null,
): Promise<{ openSource: string; pendingFirst: string | null }> {
  const row = await db.telegramStart.findUnique({ where: { telegramId } });
  const pendingFirst = row?.firstSource ?? null;
  const classified = classifyStartParam(initParam);

  if (classified.kind === "navigation") {
    return { openSource: "organic", pendingFirst };
  }

  if (classified.kind === "source") {
    await clearLatest(telegramId, row?.latestSource);
    return { openSource: classified.source, pendingFirst };
  }

  if (!row?.latestSource) {
    return { openSource: "organic", pendingFirst };
  }

  const openSource = row.latestSource;
  await clearLatest(telegramId, openSource);
  return { openSource, pendingFirst };
}

/** First touch prefers the earlier `/start` payload over this open's param. */
export function storedFirstTouch(
  initParam: string | null,
  pendingFirst: string | null,
): string {
  return pendingFirst ?? firstTouchSource(initParam);
}

async function clearLatest(
  telegramId: string,
  latestSource: string | null | undefined,
) {
  if (!latestSource) {
    return;
  }
  await db.telegramStart.updateMany({
    where: { telegramId, latestSource },
    data: { latestSource: null },
  });
}
