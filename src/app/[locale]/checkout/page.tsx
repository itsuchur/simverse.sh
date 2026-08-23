import { getLocale } from "next-intl/server";

import { redirect } from "~/i18n/navigation";
import { miniappPathForRequest } from "~/server/miniapp-path";

export default async function CheckoutRedirectPage() {
  const locale = await getLocale();
  redirect({ href: await miniappPathForRequest("/checkout"), locale });
}
