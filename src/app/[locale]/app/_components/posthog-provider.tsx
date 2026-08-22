"use client";

import { useEffect, type ReactNode } from "react";
import { PostHogProvider as PHProvider } from "posthog-js/react";

import { initPosthog, isPosthogEnabled, posthog } from "~/lib/posthog/browser";

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initPosthog();
  }, []);

  if (!isPosthogEnabled()) {
    return children;
  }

  return <PHProvider client={posthog}>{children}</PHProvider>;
}
