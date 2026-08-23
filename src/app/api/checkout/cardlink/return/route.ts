import { miniappPublicUrl } from "~/lib/miniapp-path";
import { miniappOrigin } from "~/server/urls";

function redirectFor(status: string | null) {
  const origin = miniappOrigin();
  const page = status === "fail" ? "/failed-payment" : "/successful-payment";
  return Response.redirect(miniappPublicUrl(origin, page), 303);
}

export async function GET(request: Request) {
  const status = new URL(request.url).searchParams.get("status");
  return redirectFor(status);
}

export async function POST(request: Request) {
  const status = new URL(request.url).searchParams.get("status");
  return redirectFor(status);
}
