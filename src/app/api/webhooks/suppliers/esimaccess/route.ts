import {
  esimAccessNotificationSchema,
  handleEsimAccessNotification,
  verifyEsimAccessWebhookToken,
} from "~/server/webhooks/suppliers/esimaccess";
import { withWebhookLogging } from "~/lib/webhook-logger";

export const POST = withWebhookLogging(
  "esimaccess",
  async (request: Request, payload: unknown) => {
    const token = new URL(request.url).searchParams.get("token");
    if (!verifyEsimAccessWebhookToken(token)) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (typeof payload === "string") {
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = esimAccessNotificationSchema.safeParse(payload);
    if (!parsed.success) {
      return Response.json({ error: "Invalid notification" }, { status: 400 });
    }

    await handleEsimAccessNotification(parsed.data);

    return Response.json({ success: true });
  },
);
