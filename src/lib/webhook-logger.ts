import "server-only";

import type { Prisma } from "../../generated/prisma";

import { db } from "~/server/db";

type Handler<TResponse extends Response> = (
  request: Request,
  body: unknown,
) => TResponse | Promise<TResponse>;

export function withWebhookLogging<TResponse extends Response>(
  source: string,
  handler: Handler<TResponse>,
) {
  return async function (request: Request): Promise<TResponse> {
    const text = await request.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text; // not valid JSON, log raw text instead
    }

    // Log first, don't let a DB failure block the webhook response
    try {
      await db.webhookLog.create({
        data: {
          source,
          headers: Object.fromEntries(
            request.headers.entries(),
          ) satisfies Prisma.InputJsonObject,
          ...(body === null ? {} : { payload: body }),
        },
      });
    } catch (error) {
      console.error("Failed to log webhook:", error);
    }

    return handler(request, body);
  };
}
