"use client";

import { useEffect } from "react";

import {
  classifyStartParam,
  coalesceStartParam,
} from "~/lib/acquisition-source";
import { captureAppOpened } from "~/lib/posthog/browser";

const TRACKED_KEY = "acquisition_tracked";

function readStartParam(): string | null {
  return coalesceStartParam(
    window.Telegram?.WebApp?.initDataUnsafe?.start_param,
    new URLSearchParams(window.location.search).get("tgWebAppStartParam"),
  );
}

let tracking = false;

async function recordAcquisition(initData: string | undefined): Promise<{
  source: string | null;
  openSource: string;
} | null> {
  if (!initData) {
    return null;
  }
  const response = await fetch("/api/account/attribution", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData }),
  });
  if (!response.ok) {
    throw new Error(`attribution ${response.status}`);
  }
  return (await response.json()) as {
    source: string | null;
    openSource: string;
  };
}

/**
 * Saves the first-touch source and records this open in PostHog.
 * Payment deep links are not counted as acquisition visits.
 */
export function AcquisitionTracker() {
  useEffect(() => {
    if (tracking || window.sessionStorage.getItem(TRACKED_KEY) === "1") {
      return;
    }
    tracking = true;
    const startParam = readStartParam();
    const initData = window.Telegram?.WebApp?.initData;

    void recordAcquisition(initData)
      .then((recorded) => {
        window.sessionStorage.setItem(TRACKED_KEY, "1");
        const classified = classifyStartParam(startParam);
        if (classified.kind === "navigation") {
          return;
        }
        const source =
          recorded?.openSource ??
          (classified.kind === "source" ? classified.source : "organic");
        const recordedSource = classifyStartParam(source);
        captureAppOpened({
          source,
          startParam:
            recordedSource.kind === "source" ? recordedSource.source : undefined,
          initialSource: recorded?.source,
        });
      })
      .catch((error: unknown) => {
        tracking = false;
        console.error("[acquisition] failed to record source", error);
      });
  }, []);

  return null;
}
