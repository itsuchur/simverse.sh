import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { mock } from "bun:test";
import { PrismaClient } from "@prisma/client";

// Always creates an isolated local database. Never uses DATABASE_URL or a VPS.
const name = `simverse-payment-test-${crypto.randomUUID()}`;
const migration = "20261025010000_payment_reconciliation";
let client: PrismaClient | undefined;

async function command(args: string[], input?: string) {
  const child = Bun.spawn(args, {
    stdin: input === undefined ? "ignore" : new TextEncoder().encode(input),
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) throw new Error(`${args[0]} ${args[1]} failed: ${stderr}`);
  return stdout.trim();
}
async function sql(source: string) {
  await command(
    [
      "docker",
      "exec",
      "-i",
      name,
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-q",
    ],
    source,
  );
}

try {
  await command([
    "docker",
    "run",
    "--detach",
    "--rm",
    "--name",
    name,
    "--publish",
    "127.0.0.1::5432",
    "-e",
    "POSTGRES_PASSWORD=local-test-only",
    "postgres:18.6",
  ]);
  for (let attempt = 0; ; attempt++) {
    try {
      await command([
        "docker",
        "exec",
        name,
        "pg_isready",
        "-h",
        "127.0.0.1",
        "-U",
        "postgres",
      ]);
      break;
    } catch (error) {
      if (attempt >= 50) throw error;
      await Bun.sleep(200);
    }
  }
  for (const entry of (await readdir("prisma/migrations")).sort()) {
    if (entry >= migration || !/^\d/.test(entry)) continue;
    await sql(await Bun.file(`prisma/migrations/${entry}/migration.sql`).text());
  }
  await sql(`
    INSERT INTO "user" (id,name,email,"emailVerified","createdAt","updatedAt") VALUES ('owner','Test owner','owner@example.test',false,NOW(),NOW());
    INSERT INTO orders (user_id,reseller_code,reseller_plan_id,package_name,validity_days,price_amount,currency,payment_provider,payment_invoice_url)
      SELECT 'owner','esimaccess','p' || n,'Test',7,500,'USD','trybit','https://pay.trybit.com/' || n FROM generate_series(1,26) n;
  `);
  await sql(await Bun.file(`prisma/migrations/${migration}/migration.sql`).text());
  const address = await command(["docker", "port", name, "5432/tcp"]);
  client = new PrismaClient({ datasources: { db: { url: `postgresql://postgres:local-test-only@${address}/postgres` } } });
  const migrated = await client.order.findMany({ orderBy: { id: "asc" } });
  assert.equal(migrated.length, 26);
  assert(migrated.every((order) => order.paymentInvoiceId === null && order.paymentNextCheckAt instanceof Date));
  for (const order of migrated) {
    await client.order.update({
      where: { id: order.id },
      data: { paymentInvoiceId: `INV-${order.id}`, paymentNextCheckAt: new Date(0) },
    });
  }

  process.env.SKIP_ENV_VALIDATION = "1";
  process.env.TRYBIT_API_KEY = "test";
  process.env.TRYBIT_SHOP_ID = "test";
  process.env.TRYBIT_SECRET_KEY = "test";
  (globalThis as { prisma?: PrismaClient }).prisma = client;
  const isolatedDb = { db: client, isUniqueConstraintError: () => false };
  void mock.module("server-only", () => ({}));
  void mock.module("~/server/db", () => isolatedDb);
  void mock.module("../src/server/db", () => isolatedDb);
  void mock.module("@sentry/nextjs", () => ({ captureException: (error: unknown) => { throw error; }, captureMessage: () => undefined }));
  void mock.module("../src/lib/posthog/server", () => ({
    captureServerEvent: () => undefined,
    recordEsimFulfillment: () => undefined,
  }));
  const originalFetch = globalThis.fetch;
  let lookups = 0;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    lookups++;
    const { uuids } = JSON.parse(init!.body as string) as { uuids: string[] };
    const order = migrated.find((row) => `INV-${row.id}` === uuids[0])!;
    return Response.json({ status: "success", result: [{ uuid: uuids[0], order_id: order.orderUuid, status: "created", amount_usd: 5 }] });
  }) as typeof fetch;
  try {
    assert.equal((await import("../src/server/db")).db, client);
    assert.equal((await import("~/server/db")).db, client);
    const { reconcilePendingPayments } = await import("../src/server/orders/payment-reconciliation");
    await reconcilePendingPayments();
    assert.equal(lookups, 25);
    await reconcilePendingPayments();
    assert.equal(lookups, 26);
    await client.order.updateMany({ data: { paymentNextCheckAt: new Date(0) } });
    lookups = 0;
    await Promise.all([reconcilePendingPayments(), reconcilePendingPayments()]);
    await reconcilePendingPayments();
    assert.equal(lookups, 26, "concurrent workers must claim each invoice only once");
  } finally { globalThis.fetch = originalFetch; }

  await client.webhookLog.createMany({ data: Array.from({ length: 25 }, (_, i) => ({ source: "xhub", payload: { order_id: "AbCd", nested: { status: "paid", sequence: i } }, receivedAt: new Date("2026-10-25T00:00:00Z") })) });
  await client.webhookLog.create({ data: { source: "trybit", payload: { order_id: "AbCd", literal: "%_" } } });
  const { searchWebhookLogs } = await import("../src/server/dashboard/webhook-search");
  const first = await searchWebhookLogs("xhub", "abcd", 1);
  const second = await searchWebhookLogs("xhub", "abcd", 99);
  assert.equal(first.total, 25);
  assert.equal(first.logs.length, 20);
  assert.equal(second.page, 2);
  assert.equal(second.logs.length, 5);
  assert.equal(new Set([...first.logs, ...second.logs].map((row) => row.id)).size, 25);
  assert.equal((await searchWebhookLogs("all", "abcd", 1)).total, 26);
  assert.equal((await searchWebhookLogs("all", "%_", 1)).total, 1);
  assert.equal((await searchWebhookLogs("xhub", "%_", 1)).total, 0);
  assert.equal((await searchWebhookLogs("all", "' OR TRUE --", 1)).total, 0);
  assert.equal((await searchWebhookLogs("all", "", 1)).total, 26);
  console.log("Verified on isolated PostgreSQL: additive migration, existing drafts, batch rotation, concurrent payment claims, payload search, case-insensitivity, source filtering, stable pagination, and literal/injection-safe search.");
} finally {
  await client?.$disconnect();
  await command(["docker", "stop", name]).catch(() => undefined);
}
