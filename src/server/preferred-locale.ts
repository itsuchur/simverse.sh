import "server-only";

import { headers } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";

import {
  preferredLocaleRedirectTarget,
  PUBLIC_PATHNAME_HEADER,
  PUBLIC_SEARCH_HEADER,
} from "~/i18n/preferred-locale";
import { db } from "~/server/db";

/**
 * The Mini App opens at an unprefixed URL. After Telegram drops NEXT_LOCALE,
 * next-intl follows Accept-Language. The account preference has to win.
 */
export async function redirectToPreferredLocale(userId: string) {
  const [locale, user, headerList] = await Promise.all([
    getLocale(),
    db.user.findUnique({
      where: { id: userId },
      select: { preferredLanguage: true },
    }),
    headers(),
  ]);

  const target = preferredLocaleRedirectTarget(
    locale,
    user?.preferredLanguage,
    headerList.get(PUBLIC_PATHNAME_HEADER) ?? "",
    headerList.get(PUBLIC_SEARCH_HEADER) ?? "",
  );
  if (target) redirect(target);
}
