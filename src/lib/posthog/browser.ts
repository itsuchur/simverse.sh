"use client";

import posthog from "posthog-js";

import { env } from "~/env";

const ingestHost = "/ingest";

let initialized = false;

export function isPosthogEnabled() {
  return Boolean(env.NEXT_PUBLIC_POSTHOG_KEY);
}

export function initPosthog() {
  const key = env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || initialized || typeof window === "undefined") {
    return;
  }

  posthog.init(key, {
    api_host: ingestHost,
    ui_host: (env.NEXT_PUBLIC_POSTHOG_HOST ?? "").includes("eu.")
      ? "https://eu.posthog.com"
      : "https://us.posthog.com",
    person_profiles: "identified_only",
    capture_pageview: false,
    persistence: "localStorage",
    disable_session_recording: true,
    autocapture: true,
  });
  initialized = true;
}

export function captureAppEvent(
  event: string,
  properties?: Record<string, string | number | boolean | null | undefined>,
) {
  initPosthog();
  if (!initialized) {
    return;
  }
  posthog.capture(event, properties);
}

export { posthog };
