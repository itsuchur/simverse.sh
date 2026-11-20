import { POST as plategaCheckout } from "~/app/api/checkout/platega/route";
import { POST as xhubCheckout } from "~/app/api/checkout/xhub/route";
import { getSbpProvider } from "~/server/sbp-provider";

/** SBP checkout; the dashboard picks which provider handles it. */
export async function POST(request: Request) {
  return (await getSbpProvider()) === "platega"
    ? plategaCheckout(request)
    : xhubCheckout(request);
}
