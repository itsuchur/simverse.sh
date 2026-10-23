import { z } from "zod";

import { getAuth } from "~/server/better-auth";
import { db } from "~/server/db";
import { limitMiniappRequest } from "~/server/http/rate-limit";

const bodySchema = z.object({
  visitorId: z.string().min(1).max(128),
});

function unauthorized() {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(request: Request) {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) {
    return unauthorized();
  }

  const limited = await limitMiniappRequest(session.user.id, "account");
  if (limited) return limited;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = bodySchema.safeParse(json);
  if (!body.success) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }

  await db.user.updateMany({
    where: { id: session.user.id, fingerprint: null },
    data: { fingerprint: body.data.visitorId },
  });

  return new Response(null, { status: 204 });
}
