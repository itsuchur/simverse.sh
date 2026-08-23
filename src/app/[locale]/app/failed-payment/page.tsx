import { PaymentResultRedirect } from "../_components/payment-result-redirect";
import { getSession } from "~/server/better-auth/server";
import { getCartPlan } from "~/server/cart";
import type { MiniappPage } from "~/lib/miniapp-path";

const FAIL_LOTTIE =
  "https://lottie.host/c297583a-3af1-429c-9ac0-8dd7bac4ec86/Xw8ldLqcok.lottie";

export const dynamic = "force-dynamic";

export default async function FailedPaymentPage() {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const telegramId = session.user.telegramId;
  const plan =
    typeof telegramId === "string" && telegramId.length > 0
      ? await getCartPlan(telegramId)
      : null;

  const page: MiniappPage = plan ? "/checkout" : "/";

  return <PaymentResultRedirect src={FAIL_LOTTIE} page={page} />;
}
