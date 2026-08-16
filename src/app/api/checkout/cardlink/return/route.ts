import { env } from "~/env";

function redirectFor(status: string | null) {
  const origin = env.BETTER_AUTH_URL.replace(/\/$/, "");
  const path = status === "fail" ? "/app/checkout" : "/app/myesim";
  return Response.redirect(`${origin}${path}`, 303);
}

export async function GET(request: Request) {
  const status = new URL(request.url).searchParams.get("status");
  return redirectFor(status);
}

export async function POST(request: Request) {
  const status = new URL(request.url).searchParams.get("status");
  return redirectFor(status);
}
