import "server-only";

import * as Sentry from "@sentry/nextjs";

import type { Prisma } from "../../generated/prisma";

import { db } from "~/server/db";

type Handler = (
  request: Request,
  body: unknown,
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
      request.headers.entries(),
    ) satisfies Prisma.InputJsonObject;

    let body: unknown = null;
    try {
      const text = await request.text();
      const contentType = request.headers.get("content-type") ?? "";
      if (contentType.includes("application/x-www-form-urlencoded")) {
        body = text ? Object.fromEntries(new URLSearchParams(text)) : null;
      } else {
        try {
          body = text ? JSON.parse(text) : null;
        } catch {
          body = text;
        }
      }
    } catch (error) {
      captureWebhookError(error, source, "read-body");

      try {
        await db.webhookLog.create({ data: { source, headers } });
      } catch (loggingError) {
        captureWebhookError(loggingError, source, "persist");
        return loggingUnavailableResponse();
      }

      return Response.json(
        { error: "Unable to read webhook body" },
        { status: 400 },
      );
    }

    // Persist before dispatch. Returning a retryable error on failure prevents
    // provider logic from running without a durable audit record.
    try {
      await db.webhookLog.create({
        data: {
          source,
          headers,
          ...(body === null ? {} : { payload: body }),
        },
      });
    } catch (error) {
      captureWebhookError(error, source, "persist");
      return loggingUnavailableResponse();
    }

    return handler(request, body);
  };
}
