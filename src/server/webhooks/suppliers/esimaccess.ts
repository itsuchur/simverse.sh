import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { env } from "~/env";

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

export async function handleEsimAccessNotification(
  notification: EsimAccessNotification,
): Promise<void> {
  switch (notification.notifyType) {
    case "CHECK_HEALTH":
      // Setup verification ping; acknowledging with 200 is all that's needed.
      return;
    case "ORDER_STATUS":
    case "ESIM_STATUS":
    case "SMDP_EVENT":
    case "DATA_USAGE":
    case "VALIDITY_USAGE":
      // Order fulfillment is not implemented yet. Notifications are only
      // hints; when implemented, re-query the eSIM Access API for the
      // authoritative state instead of trusting the payload.
      console.log(
        `[webhook:esimaccess] ${notification.notifyType}`,
        notification.content ?? {},
      );
      return;
  }
}
