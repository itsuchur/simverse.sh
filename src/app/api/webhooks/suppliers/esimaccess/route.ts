import { handleEsimAccessWebhook } from "~/server/webhooks/suppliers/esimaccess";

export async function POST(request: Request) {
    const result = handleEsimAccessWebhook();

    return Response.json({ result });
}