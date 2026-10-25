import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { mock } from "bun:test";
import { PrismaClient } from "@prisma/client";

// Always creates an isolated local database. Never uses DATABASE_URL or a VPS.
const name = `simverse-capacity-test-${crypto.randomUUID()}`;
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
    if (!/^\d/.test(entry)) continue;
    await sql(
      await Bun.file(`prisma/migrations/${entry}/migration.sql`).text(),
    );
  }
  const address = await command(["docker", "port", name, "5432/tcp"]);
  client = new PrismaClient({
    datasources: {
      db: { url: `postgresql://postgres:local-test-only@${address}/postgres` },
    },
  });
  const isolatedDb = { db: client, isUniqueConstraintError: () => false };
  void mock.module("server-only", () => ({}));
  void mock.module("~/server/db", () => isolatedDb);
  void mock.module("../src/server/db", () => isolatedDb);
  let balance = 500;
  const supplier = {
    esimAccessPost: async () => ({ success: true, obj: { balance } }),
  };
  void mock.module("~/server/suppliers/esimaccess/client", () => supplier);
  void mock.module("../src/server/suppliers/esimaccess/client", () => supplier);
  const { createPendingInvoice, failPendingInvoice } =
    await import("../src/server/orders/draft");
  await sql(
    `INSERT INTO "user" (id,name,email,"emailVerified","createdAt","updatedAt") VALUES ('owner','Test','capacity@example.test',false,NOW(),NOW());`,
  );
  const makeOrder = (provider: string) =>
    client!.order.create({
      data: {
        userId: "owner",
        resellerCode: "esimaccess",
        resellerPlanId: crypto.randomUUID(),
        packageName: "Test",
        validityDays: 7,
        priceAmount: 1000n,
        currency: "USD",
        costAmount: 500n,
        costCurrency: "USD",
        paymentProvider: provider,
      },
    });
  const a = await makeOrder("trybit");
  const b = await makeOrder("xhub");
  let invoiceCalls = 0;
  const create = async () => {
    invoiceCalls++;
    return { url: "https://pay.example/test", id: crypto.randomUUID() };
  };
  const results = await Promise.allSettled([
    createPendingInvoice(a.id, create),
    createPendingInvoice(b.id, create),
  ]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(invoiceCalls, 1);
  const rows = await client.order.findMany();
  const reserved = rows.find((r) => r.paymentInvoiceClaim !== null)!;
  const blocked = rows.find((r) => r.paymentInvoiceClaim === null)!;
  assert(reserved && blocked);
  await failPendingInvoice(reserved.id, "expired");
  await assert.rejects(
    createPendingInvoice(blocked.id, create),
    /insufficient_supplier_balance/,
  );
  balance = 1000;
  await createPendingInvoice(blocked.id, create);
  assert.equal(invoiceCalls, 2);
  const xhub = await client.order.findUniqueOrThrow({ where: { id: b.id } });
  await client.order.update({
    where: { id: xhub.id },
    data: {
      createdAt: new Date(Date.now() - 10 * 60_000),
      updatedAt: new Date(),
    },
  });
  const afterTimeout = await makeOrder("xhub");
  await createPendingInvoice(afterTimeout.id, create);
  assert.equal(invoiceCalls, 3);
  // A delayed payment restores the liability while fulfillment is outstanding.
  await client.order.update({
    where: { id: xhub.id },
    data: { paymentStatus: "paid", status: "paid" },
  });
  balance = 1500;
  const afterPayment = await makeOrder("trybit");
  await assert.rejects(
    createPendingInvoice(afterPayment.id, create),
    /insufficient_supplier_balance/,
  );
  console.log(
    "PostgreSQL capacity checks passed: concurrent admission, rollback, balance replenishment, X-Hub timeout and late-payment liability.",
  );
} finally {
  await client?.$disconnect();
  await command(["docker", "rm", "--force", name]).catch(() => undefined);
}
