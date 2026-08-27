/**
 * bun test preload (see bunfig.toml). Runs before any test file so that:
 * - `~/env` sees SKIP_ENV_VALIDATION plus deterministic test secrets,
 * - `server-only` imports are inert,
 * - Prisma, Sentry, PostHog, the Redis cart, and the eSIM Access HTTP client
 *   are replaced with in-memory fakes/spies from ./fake-db and ./mocks.
 */
import { mock } from "bun:test";

import { fakeDb, isUniqueConstraintError } from "./fake-db";
import {
  captureServerEvent,
  clearCart,
  esimAccessPost,
  sentryCaptureException,
  sentryCaptureMessage,
} from "./mocks";

process.env.SKIP_ENV_VALIDATION = "1";
process.env.DATABASE_URL ??= "postgresql://postgres:postgres@localhost:5432/test";
process.env.REDIS_URL ??= "redis://127.0.0.1:6379";
process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
process.env.TELEGRAM_BOT_TOKEN ??= "test-telegram-bot-token";
process.env.TELEGRAM_BOT_USERNAME ??= "test_bot";
process.env.ESIMACCESS_ACCESS_CODE ??= "test-esimaccess-code";
process.env.TRYBIT_API_KEY = "test-trybit-api-key";
process.env.TRYBIT_SHOP_ID = "test-trybit-shop";
process.env.TRYBIT_SECRET_KEY = "test-trybit-secret";
process.env.CARDLINK_API_TOKEN = "test-cardlink-token";
process.env.CARDLINK_SHOP_ID = "test-cardlink-shop";

void mock.module("server-only", () => ({}));

void mock.module("../server/db", () => ({
  db: fakeDb,
  isUniqueConstraintError,
}));

void mock.module("@sentry/nextjs", () => ({
  captureMessage: sentryCaptureMessage,
  captureException: sentryCaptureException,
}));

void mock.module("../lib/posthog/server", () => ({
  captureServerEvent,
}));

void mock.module("../server/cart", () => ({
  clearCart,
}));

void mock.module("../server/suppliers/esimaccess/client", () => ({
  ESIMACCESS_API_BASE: "https://api.esimaccess.example",
  esimAccessPost,
}));
