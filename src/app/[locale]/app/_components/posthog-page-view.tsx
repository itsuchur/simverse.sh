"use client";

import { useEffect } from "react";
import { useLocale } from "next-intl";

import { usePathname } from "~/i18n/navigation";
import { captureAppEvent, isPosthogEnabled } from "~/lib/posthog/browser";

export function PostHogPageView() {
  const pathname = usePathname();
  const locale = useLocale();

  useEffect(() => {
    if (!isPosthogEnabled()) {
      return;
    }
    captureAppEvent("$pageview", {
      $current_url: pathname,
      locale,
    });
  }, [pathname, locale]);

  return null;
}
