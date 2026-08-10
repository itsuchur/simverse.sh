import "server-only";

import { withWebhookLogging } from "~/lib/webhook-logger";

/**
 * Logging-only Cryptomus webhook listener.
 *
 * Signature verification and payment processing will be added separately.
 */
export const handleCryptomusWebhook = withWebhookLogging("cryptomus", () => {
  return new Response(null, { status: 204 });
});
