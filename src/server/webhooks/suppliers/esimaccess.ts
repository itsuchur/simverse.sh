import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { env } from "~/env";
import { db } from "~/server/db";
import {
  applyEsimStatus,
  attachGotResource,
  findOrderForEsimWebhook,
} from "~/server/orders/fulfill";
import { getRedis } from "~/server/redis";
import { sendMessage } from "~/server/telegram/bot-api";
import {
  usageAlertMessage,
  type UsageAlertKind,
} from "~/server/telegram/usage-alert";

/**
 * eSIM Access webhook notifications.
 *
 * eSIM Access does NOT sign its webhooks; the documented protections are a
 * sender IP allowlist and securing the endpoint yourself. We register the
 * webhook URL with a random `token` query parameter and require it on every
 * request. Documented sender IPs (enforce at the firewall / Traefik level if
 * desired): 3.1.131.226, 54.254.74.88, 18.136.190.97, 18.136.60.197,
 * 18.136.19.137.
 *
 * https://esimaccess.com/docs/what-webhook-notifications-do-you-send/
 */

const NOTIFY_ID_TTL_SECONDS = 7 * 24 * 60 * 60;
const ORDER_ALERT_TTL_SECONDS = 120 * 24 * 60 * 60;

export const esimAccessNotificationSchema = z.object({
  notifyType: z.enum([
    // Webhook setup verification ping; must be acknowledged with HTTP 200.
    "CHECK_HEALTH",
    // Ordered eSIM(s) are provisioned; query /esim/query for the ICCID.
    "ORDER_STATUS",
    // eSIM installed / enabled / disabled on a device.
    "ESIM_STATUS",
    // Installation lifecycle events (DOWNLOAD, INSTALLATION, ENABLED).
    "SMDP_EVENT",
    // Remaining data at or below threshold.
    "DATA_USAGE",
    // 1 day of validity remaining.
    "VALIDITY_USAGE",
  ]),
  notifyId: z.string().min(1).optional(),
  content: z.record(z.string(), z.unknown()).optional(),
});

export type EsimAccessNotification = z.infer<
  typeof esimAccessNotificationSchema
>;

/** Constant-time comparison of the URL token against the configured secret. */
export function verifyEsimAccessWebhookToken(token: string | null): boolean {
  const secret = env.ESIMACCESS_WEBHOOK_SECRET;
  if (!secret || !token) {
    return false;
  }
  // Hash both sides to fixed length so timingSafeEqual never throws on
  // length mismatch and comparison time does not depend on the input.
  const a = createHash("sha256").update(token).digest();
  const b = createHash("sha256").update(secret).digest();
  return timingSafeEqual(a, b);
}

function contentString(
  content: Record<string, unknown> | undefined,
  key: string,
): string | null {
  const value = content?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function contentNumber(
  content: Record<string, unknown> | undefined,
  key: string,
): number | null {
  const value = content?.[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** SET NX EX — returns true when this process claimed the key. */
async function claimOnce(
  key: string,
  ttlSeconds: number,
): Promise<boolean> {
  const redis = await getRedis();
  const result = await redis.set(key, "1", { NX: true, EX: ttlSeconds });
  return result === "OK";
}

async function notifyBuyerUsageAlert(input: {
  kind: UsageAlertKind;
  notifyId: string | undefined;
  content: Record<string, unknown> | undefined;
}): Promise<void> {
  if (input.notifyId) {
    const claimedNotify = await claimOnce(
      `esim:usage-alert:notify:${input.notifyId}`,
      NOTIFY_ID_TTL_SECONDS,
    );
    if (!claimedNotify) {
      return;
    }
  }

  const order = await findOrderForEsimWebhook({
    iccid: contentString(input.content, "iccid"),
    orderNo: contentString(input.content, "orderNo"),
    transactionId: contentString(input.content, "transactionId"),
  });
  if (!order) {
    return;
  }

  const claimedOrder = await claimOnce(
    `esim:usage-alert:order:${order.id.toString()}:${input.kind}`,
    ORDER_ALERT_TTL_SECONDS,
  );
  if (!claimedOrder) {
    return;
  }

  const user = await db.user.findUnique({
    where: { id: order.userId },
    select: {
      telegramId: true,
      languageCode: true,
      isBanned: true,
      isDeleted: true,
    },
  });
  if (
    !user ||
    user.isBanned ||
    user.isDeleted ||
    typeof user.telegramId !== "string" ||
    user.telegramId.length === 0
  ) {
    return;
  }

  const chatId = Number(user.telegramId);
  if (!Number.isFinite(chatId) || chatId <= 0) {
    return;
  }

  const message = usageAlertMessage({
    kind: input.kind,
    languageCode: user.languageCode,
    packageName: order.packageName,
    remainBytes:
      input.kind === "DATA_USAGE"
        ? contentNumber(input.content, "remain")
        : null,
  });

  try {
    await sendMessage({
      chatId,
      text: message.text,
      replyMarkup: message.replyMarkup,
    });
  } catch (error) {
    // Prefer a missed alert over spam: order claim is not released.
    Sentry.captureException(error, {
      tags: { component: "telegram", reason: "usage_alert_failed" },
      extra: { orderId: order.id.toString(), kind: input.kind },
    });
  }
}

export async function handleEsimAccessNotification(
  notification: EsimAccessNotification,
): Promise<void> {
  switch (notification.notifyType) {
    case "CHECK_HEALTH":
      return;
    case "ORDER_STATUS": {
      const orderStatusValue = contentString(
        notification.content,
        "orderStatus",
      );
      if (orderStatusValue !== "GOT_RESOURCE") {
        return;
      }
      await attachGotResource({
        orderNo: contentString(notification.content, "orderNo"),
        transactionId: contentString(notification.content, "transactionId"),
      });
      return;
    }
    case "ESIM_STATUS":
    case "SMDP_EVENT": {
      const esimStatus = contentString(notification.content, "esimStatus");
      const smdpStatus = contentString(notification.content, "smdpStatus");
      if (!esimStatus && !smdpStatus) {
        return;
      }
      await applyEsimStatus({
        iccid: contentString(notification.content, "iccid"),
        orderNo: contentString(notification.content, "orderNo"),
        transactionId: contentString(notification.content, "transactionId"),
        esimStatus,
        smdpStatus,
      });
      return;
    }
    case "DATA_USAGE":
    case "VALIDITY_USAGE":
      await notifyBuyerUsageAlert({
        kind: notification.notifyType,
        notifyId: notification.notifyId,
        content: notification.content,
      });
      return;
  }
}
