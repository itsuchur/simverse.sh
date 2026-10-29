import "server-only";

import {
  classifyStartPayload,
  firstTouchSource,
  startPayloadSource,
} from "~/lib/acquisition-source";
import { db } from "~/server/db";

export async function registeredTrafficSourceCodes(): Promise<Set<string>> {
  const rows = await db.trafficSourceCode.findMany({
    select: { code: true },
  });
  return new Set(rows.map((row) => row.code));
}

/** Remember a `/start` payload. The first one sticks; later ones update latest. */
export async function rememberTelegramStart(
  telegramId: string,
  payload: string,
) {
  const allowed = await registeredTrafficSourceCodes();
  const source = startPayloadSource(payload, allowed);
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
  try {
    await db.telegramStartLog.create({
      data: { telegramId, payload, source },
    });
  } catch {
    // The click log is optional. The row above is what the Mini App reads.
  }
}

/**
 * Source of this Mini App open. A signed `start_param` wins. Otherwise the
 * latest unused `/start` payload is consumed. Payment params are not visits.
 */
export async function openSourceForTelegramUser(
  telegramId: string,
  initParam: string | null,
  allowed: ReadonlySet<string>,
): Promise<{ openSource: string; pendingFirst: string | null }> {
  const row = await db.telegramStart.findUnique({ where: { telegramId } });
  const pendingFirst = row?.firstSource ?? null;
  const classified = classifyStartPayload(initParam, allowed);

  if (classified.kind === "navigation") {
    return { openSource: "organic", pendingFirst };
  }

  if (classified.kind === "source" || classified.kind === "unknown") {
    await clearLatest(telegramId, row?.latestSource);
    return {
      openSource: classified.kind === "source" ? classified.source : "unknown",
      pendingFirst,
    };
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
  allowed: ReadonlySet<string>,
): string {
  return pendingFirst ?? firstTouchSource(initParam, allowed);
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
