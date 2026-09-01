import { miniappDeepLink } from "~/server/urls";

function redirectFor(status: string | null) {
  const result = status === "fail" ? "fail" : "success";
  return Response.redirect(miniappDeepLink(result), 303);
}

export async function GET(request: Request) {
  const status = new URL(request.url).searchParams.get("status");
  return redirectFor(status);
}

export async function POST(request: Request) {
  const status = new URL(request.url).searchParams.get("status");
  return redirectFor(status);
}
