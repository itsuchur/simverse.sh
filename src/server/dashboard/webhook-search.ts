import "server-only";

import { Prisma, type WebhookLog } from "@prisma/client";
import { db } from "~/server/db";

export const WEBHOOK_PAGE_SIZE = 20;

export function webhookSearchPredicate(source: string, query: string) {
  return Prisma.sql`
    ${source === "all" ? Prisma.sql`TRUE` : Prisma.sql`source = ${source}`}
    AND (strpos(lower(coalesce(payload::text, '')), lower(${query})) > 0
      OR strpos(lower(source), lower(${query})) > 0
      OR id::text = ${query})
  `;
}

export async function searchWebhookLogs(source: string, query: string, requestedPage: number) {
  const where = source === "all" ? {} : { source };
  const predicate = webhookSearchPredicate(source, query);
  const total = query
    ? Number((await db.$queryRaw<Array<{ count: bigint }>>`SELECT count(*) AS count FROM webhook_logs WHERE ${predicate}`)[0]!.count)
    : await db.webhookLog.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / WEBHOOK_PAGE_SIZE));
  const page = Math.min(requestedPage, pageCount);
  const skip = (page - 1) * WEBHOOK_PAGE_SIZE;
  const logs = query
    ? await db.$queryRaw<WebhookLog[]>`
      SELECT id, source, payload, headers, received_at AS "receivedAt"
      FROM webhook_logs WHERE ${predicate}
      ORDER BY received_at DESC, id DESC LIMIT ${WEBHOOK_PAGE_SIZE} OFFSET ${skip}`
    : await db.webhookLog.findMany({ where, take: WEBHOOK_PAGE_SIZE, skip, orderBy: [{ receivedAt: "desc" }, { id: "desc" }] });
  return { total, pageCount, page, logs };
}
