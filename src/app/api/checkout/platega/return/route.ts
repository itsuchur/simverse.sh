import { paymentReturnTarget } from "~/server/urls";

function redirectFor(request: Request) {
  const params = new URL(request.url).searchParams;
  const result = params.get("status") === "fail" ? "fail" : "success";
  return Response.redirect(paymentReturnTarget(result, params), 303);
}

export function GET(request: Request) {
  return redirectFor(request);
}

export function POST(request: Request) {
  return redirectFor(request);
}
