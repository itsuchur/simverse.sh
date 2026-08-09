import {
  esimAccessNotificationSchema,
  handleEsimAccessNotification,
  verifyEsimAccessWebhookToken,
} from "~/server/webhooks/suppliers/esimaccess";

export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!verifyEsimAccessWebhookToken(token)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = esimAccessNotificationSchema.safeParse(payload);
  if (!parsed.success) {
    return Response.json({ error: "Invalid notification" }, { status: 400 });
  }

  await handleEsimAccessNotification(parsed.data);

  return Response.json({ success: true });
}
