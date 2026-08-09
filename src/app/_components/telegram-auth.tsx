"use client";

import { useEffect } from "react";

import { autoSignInFromMiniApp } from "~/server/better-auth/client";

/** Silent Mini App auth — no status UI. */
export function TelegramAuth() {
  useEffect(() => {
    async function authenticate() {
      try {
        const result = await autoSignInFromMiniApp();
        if (result.error) {
          console.error(result.error);
        }
      } catch (error) {
        console.error(error);
      }
    }

    void authenticate();
  }, []);

  return null;
}
