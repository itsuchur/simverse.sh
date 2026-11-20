import { CheckoutScreen } from "~/components/store/checkout-screen";
import { getSession } from "~/server/better-auth/server";
import { miniappPathForRequest } from "~/server/miniapp-path";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ revision?: string | string[] }>;
}) {
  // Tie this render to the revision query. The query is only a cache key;
  // the package still comes from the cart snapshot below.
  await searchParams;

  const session = await getSession();
  if (!session) {
    return null;
  }

  return (
    <CheckoutScreen
      session={session}
      channel="miniapp"
      catalogHref={await miniappPathForRequest("/")}
      myEsimsHref={await miniappPathForRequest("/myesim")}
    />
  );
}
