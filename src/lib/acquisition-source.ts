import type { MiniappPage } from "~/lib/miniapp-path";

const SOURCE_CODE = /^src_[A-Za-z0-9_-]{1,60}$/;

const NAVIGATION: Record<string, MiniappPage> = {
  successful_payment: "/successful-payment",
  failed_payment: "/failed-payment",
};

/** How long after registration the first open may still set the source. */
export const FIRST_TOUCH_WINDOW_MS = 60 * 60 * 1000;

export type StartParamClass =
  | { kind: "navigation"; page: MiniappPage }
  | { kind: "source"; source: string }
  | { kind: "organic" };

/**
 * A Mini App `start_param`, or the payload of `/start`. Payment codes
 * navigate. A `src_` code is an acquisition source. Anything else, including
 * a malformed `src_` value, is an ordinary open.
 */
export function classifyStartParam(
  value: string | null | undefined,
): StartParamClass {
  if (!value) {
    return { kind: "organic" };
  }
  const page = NAVIGATION[value];
  if (page) {
    return { kind: "navigation", page };
  }
  if (SOURCE_CODE.test(value)) {
    return { kind: "source", source: value };
  }
  return { kind: "organic" };
}

/** Page to open for a payment deep link. Other params stay on the Mini App. */
export function startParamPage(
  value: string | null | undefined,
): MiniappPage | null {
  const classified = classifyStartParam(value);
  return classified.kind === "navigation" ? classified.page : null;
}

/** initData wins; the launch query string is the fallback. */
export function coalesceStartParam(
  fromInitData: string | null | undefined,
  fromQuery: string | null | undefined,
): string | null {
  if (fromInitData) {
    return fromInitData;
  }
  if (fromQuery) {
    return fromQuery;
  }
  return null;
}

/** `start_param` from a validated Mini App initData query string. */
export function startParamFromInitData(initData: string): string | null {
  const value = new URLSearchParams(initData).get("start_param");
  return value && value.length > 0 ? value : null;
}

/** Value stored on a new user. Invalid and payment params count as organic. */
export function firstTouchSource(value: string | null | undefined): string {
  const classified = classifyStartParam(value);
  return classified.kind === "source" ? classified.source : "organic";
}

/**
 * Source carried by `t.me/<bot>?start=`. Payment codes are ignored so a
 * payment return does not count as a visit. Anything else is `organic`.
 */
export function startPayloadSource(
  value: string | null | undefined,
): string | null {
  const classified = classifyStartParam(value);
  if (classified.kind === "navigation") {
    return null;
  }
  if (classified.kind === "source") {
    return classified.source;
  }
  return "organic";
}

/** Text after `/start` or `/start@bot`. Empty when the command has no payload. */
export function startCommandPayload(text: string): string {
  const match = /^\/start(?:@[A-Za-z0-9_]+)?(?:\s+(\S+))?/.exec(text);
  return match?.[1] ?? "";
}

export function isWithinFirstTouchWindow(
  createdAt: Date,
  now = Date.now(),
): boolean {
  return now - createdAt.getTime() <= FIRST_TOUCH_WINDOW_MS;
}

/** Event property for orders. Unset accounts stay distinguishable from organic. */
export function reportedAcquisitionSource(
  stored: string | null | undefined,
): string {
  return stored && stored.length > 0 ? stored : "unknown";
}
