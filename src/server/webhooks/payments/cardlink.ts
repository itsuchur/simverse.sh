import "server-only";

import { withWebhookLogging } from "~/lib/webhook-logger";

/**
 * Logging-only Cardlink webhook listener.
 *
 * Signature verification and payment processing will be added separately.
 */
export const handleCardlinkWebhook = withWebhookLogging("cardlink", () => {
  return new Response(null, { status: 204 });
});
