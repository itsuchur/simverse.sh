import "server-only";

import * as Sentry from "@sentry/nextjs";

import type { Prisma } from "../../generated/prisma";

import { db } from "~/server/db";

/** `null` = ok; `Response` = 503 logging-unavailable. */
export type PersistWebhookLog = () => Promise<Response | null>;

type Handler = (
  request: Request,
  body: unknown,
  rawBody: string,
  persist: PersistWebhookLog,
) => Response | Promise<Response>;

function captureWebhookError(
  error: unknown,
  source: string,
  phase: "read-body" | "persist",
) {
  Sentry.captureException(error, {
    tags: {
      component: "webhook-logger",
      webhook_source: source,
      webhook_phase: phase,
    },
  });
}

function loggingUnavailableResponse() {
  return Response.json(
    { error: "Webhook logging unavailable" },
    {
      status: 503,
      headers: { "Retry-After": "30" },
    },
  );
}

export function withWebhookLogging(source: string, handler: Handler) {
  return async function (request: Request): Promise<Response> {
    const headers = Object.fromEntries(
      Array.from(request.headers.entries(), ([name, value]) => [
        name,
        name === "x-secret" ? "[REDACTED]" : value,
      ]),
    ) satisfies Prisma.InputJsonObject;

    let rawBody = "";
    let body: unknown = null;
    try {
      rawBody = await request.text();
      const contentType = request.headers.get("content-type") ?? "";
      if (contentType.includes("application/x-www-form-urlencoded")) {
        body = rawBody
          ? Object.fromEntries(new URLSearchParams(rawBody))
          : null;
      } else {
        try {
          body = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          body = rawBody;
        }
      }
    } catch (error) {
      captureWebhookError(error, source, "read-body");
      return Response.json(
        { error: "Unable to read webhook body" },
        { status: 400 },
      );
    }

    // Call after signature/credential verification and before business logic.
    // Returning a retryable error on failure prevents provider logic from
    // running without a durable audit record.
    const persist: PersistWebhookLog = async () => {
      try {
        await db.webhookLog.create({
          data: {
            source,
            headers,
            ...(body === null ? {} : { payload: body }),
          },
        });
        return null;
      } catch (error) {
        captureWebhookError(error, source, "persist");
        return loggingUnavailableResponse();
      }
    };

    return handler(request, body, rawBody, persist);
  };
}
