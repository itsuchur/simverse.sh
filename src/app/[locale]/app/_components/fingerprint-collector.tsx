"use client";

import { useEffect } from "react";

/**
 * Collects the first FingerprintJS visitorId after Mini App sign-in and
 * stores it on the Better Auth user. No-ops if the request fails.
 */
export function FingerprintCollector() {
  useEffect(() => {
    let cancelled = false;

    void import("@fingerprintjs/fingerprintjs")
      .then(({ load }) => load())
      .then((fp) => fp.get())
      .then((result) => {
        if (cancelled || result.visitorId.length === 0) {
          return;
        }
        return fetch("/api/fingerprint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ visitorId: result.visitorId }),
        });
      })
      .catch((error: unknown) => {
        console.error("[fingerprint] failed to collect visitorId", error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
