/**
 * Shared spies installed by setup.ts in place of side-effectful modules
 * (Sentry, PostHog, Redis cart, eSIM Access HTTP client). Test files import
 * these to stub behavior and assert calls.
 */
import { mock } from "bun:test";
import { createHmac } from "node:crypto";

import { fakeDb } from "./fake-db";

export const sentryCaptureMessage = mock(
  (_message: string, _context?: unknown) => "",
);
export const sentryCaptureException = mock(
  (_error: unknown, _context?: unknown) => "",
);

export const captureServerEvent = mock(
  (_input: {
    event: string;
    distinctId: string | null | undefined;
    orderUuid: string;
    properties?: Record<string, unknown>;
  }) => undefined,
);

export function capturedEvents(): string[] {
  return captureServerEvent.mock.calls.map((call) => call[0].event);
}

export const clearCart = mock(async (_telegramId: string) => undefined);

type EsimAccessEnvelope = {
  success: boolean;
  errorCode?: string;
  errorMsg?: string | null;
  obj?: unknown;
};

const defaultEsimAccessImpl = async (
  path: string,
  _payload?: unknown,
): Promise<EsimAccessEnvelope> => {
  throw new Error(`esimAccessPost not stubbed for ${path}`);
};

export const esimAccessPost = mock(defaultEsimAccessImpl);

/** Stubs the supplier API: /esim/order returns orderNo, /esim/query profiles. */
export function stubEsimAccess(input?: {
  orderNo?: string;
  profiles?: Array<Record<string, unknown>>;
}) {
  esimAccessPost.mockImplementation(async (path: string) => {
    if (path === "/esim/order") {
      return {
        success: true,
        obj: { orderNo: input?.orderNo ?? "EA-ORDER-1" },
      };
    }
    if (path === "/esim/query") {
      return { success: true, obj: { esimList: input?.profiles ?? [] } };
    }
    throw new Error(`unexpected esimAccessPost path: ${path}`);
  });
}

export function esimOrderCallCount(): number {
  return esimAccessPost.mock.calls.filter((call) => call[0] === "/esim/order")
    .length;
}

function base64Url(buffer: Buffer): string {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/** Builds an HS256 JWT the way Trybit signs postback tokens. */
export function signTrybitToken(
  payload: Record<string, unknown> = {},
  options?: { alg?: string; secret?: string },
): string {
  const alg = options?.alg ?? "HS256";
  const secret = options?.secret ?? process.env.TRYBIT_SECRET_KEY!;
  const header = base64Url(Buffer.from(JSON.stringify({ alg, typ: "JWT" })));
  const body = base64Url(Buffer.from(JSON.stringify(payload)));
  const signature = base64Url(
    createHmac("sha256", secret).update(`${header}.${body}`).digest(),
  );
  return `${header}.${body}.${signature}`;
}

/** Call from beforeEach: wipes the fake DB and clears every spy. */
export function resetTestState() {
  fakeDb.reset();
  sentryCaptureMessage.mockClear();
  sentryCaptureException.mockClear();
  captureServerEvent.mockClear();
  clearCart.mockClear();
  esimAccessPost.mockClear();
  esimAccessPost.mockImplementation(defaultEsimAccessImpl);
}
