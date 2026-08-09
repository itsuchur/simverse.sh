"use client";

import { useEffect, useState } from "react";

import { autoSignInFromMiniApp } from "~/server/better-auth/client";

export function TelegramAuth() {
  const [status, setStatus] = useState("Authenticating...");

  useEffect(() => {
    async function authenticate() {
      try {
        const result = await autoSignInFromMiniApp();

        if (result.error) {
          console.error(result.error);
          setStatus("Authentication failed");
          return;
        }

        setStatus("Authenticated");
      } catch (error) {
        console.error(error);
        setStatus("Authentication failed");
      }
    }

    void authenticate();
  }, []);

  return <div>{status}</div>;
}
