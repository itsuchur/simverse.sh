import "server-only";

import { PostHog } from "posthog-node";

import { env } from "~/env";

let client: PostHog | null | undefined;

function getPosthog() {
  if (client !== undefined) {
    return client;
  }

  const key = env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) {
    client = null;
    return client;
  }

  client = new PostHog(key, {
    host: env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    flushAt: 1,
    flushInterval: 0,
  });
  return client;
}

export function captureServerEvent(input: {
  event: string;
  distinctId: string | null | undefined;
  orderUuid: string;
  properties?: Record<string, string | number | boolean | null | undefined>;
}) {
  if (typeof input.distinctId !== "string" || input.distinctId.length === 0) {
    return;
  }

  const posthog = getPosthog();
  if (!posthog) {
    return;
  }

  posthog.capture({
    distinctId: input.distinctId,
    event: input.event,
    properties: {
      ...input.properties,
      orderUuid: input.orderUuid,
      $insert_id: `${input.event}:${input.orderUuid}`,
    },
  });
  void posthog.flush().catch(() => undefined);
}
