"use client";

import { useEffect } from "react";

import { useRouter } from "~/i18n/navigation";
import {
  coalesceStartParam,
  startParamPage,
} from "~/lib/acquisition-source";
import { useMiniappPath } from "~/lib/use-miniapp-path";

// start_param persists in initData for the whole Mini App session, so mark it
// handled or the user could never navigate away from the payment result page.
const HANDLED_KEY = "handled_start_param";

function readStartParam(): string | null {
  return coalesceStartParam(
    window.Telegram?.WebApp?.initDataUnsafe?.start_param,
    new URLSearchParams(window.location.search).get("tgWebAppStartParam"),
  );
}

/**
 * Routes Telegram `startapp` deep-link params (e.g. from payment provider
 * success/fail redirects to `t.me/<bot>?startapp=...`) to Mini App pages.
 */
export function StartParamRouter() {
  const router = useRouter();
  const successHref = useMiniappPath("/successful-payment");
  const failedHref = useMiniappPath("/failed-payment");

  useEffect(() => {
    const startParam = readStartParam();
    const page = startParamPage(startParam);
    if (!startParam || !page) {
      return;
    }
    if (window.sessionStorage.getItem(HANDLED_KEY) === startParam) {
      return;
    }
    window.sessionStorage.setItem(HANDLED_KEY, startParam);
    router.replace(page === "/failed-payment" ? failedHref : successHref);
  }, [router, successHref, failedHref]);

  return null;
}
