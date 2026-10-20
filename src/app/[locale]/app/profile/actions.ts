"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { localeCookie } from "~/i18n/routing";
import { getSession } from "~/server/better-auth/server";
import { db } from "~/server/db";

const preferredLanguageSchema = z.enum(["en", "ru"]);

export async function updatePreferredLanguageAction(locale: string) {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const preferredLanguage = preferredLanguageSchema.parse(locale);

  await db.user.update({
    where: { id: session.user.id },
    data: { preferredLanguage },
  });

  const cookieStore = await cookies();
  cookieStore.set(localeCookie.name, preferredLanguage, {
    path: "/",
    sameSite: localeCookie.sameSite,
    maxAge: localeCookie.maxAge,
  });
}

export async function updateDataUsageNotificationsAction(enabled: boolean) {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { dataUsageNotifications: enabled },
  });
}
