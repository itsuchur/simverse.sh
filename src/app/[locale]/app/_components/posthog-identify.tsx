"use client";

import { useEffect } from "react";

import { initPosthog, isPosthogEnabled, posthog } from "~/lib/posthog/browser";

export function PostHogIdentify({
  telegramId,
  languageCode,
  isPremium,
  fingerprint,
}: {
  telegramId: string | null;
  languageCode: string | null;
  isPremium: boolean;
  fingerprint: string | null;
}) {
  useEffect(() => {
    if (!isPosthogEnabled() || !telegramId) {
      return;
    }

    initPosthog();
    posthog.identify(telegramId, {
      languageCode: languageCode ?? undefined,
      isPremium,
      fingerprint: fingerprint ?? undefined,
    });
  }, [telegramId, languageCode, isPremium, fingerprint]);

  return null;
}
