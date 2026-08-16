import { getLocale } from "next-intl/server";

import { redirect } from "~/i18n/navigation";

export default async function CheckoutRedirectPage() {
  const locale = await getLocale();
  redirect({ href: "/app/checkout", locale });
}
