import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";

// Always creates an isolated local database. Never uses DATABASE_URL or a VPS.
const name = `simverse-refunds-test-${crypto.randomUUID()}`;
const migration = "20261024180000_create_refunds";
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
    if (entry >= migration) continue;
    if (/^\d/.test(entry))
      await sql(
        await Bun.file(`prisma/migrations/${entry}/migration.sql`).text(),
      );
  }
  await sql(`
    INSERT INTO "user" (id,name,email,"emailVerified","createdAt","updatedAt") VALUES ('owner','Test owner','owner@example.test',false,NOW(),NOW());
    INSERT INTO orders (id,user_id,reseller_code,reseller_plan_id,package_name,validity_days,price_amount,currency,payment_provider,payment_status,status,payment_charge_id,payment_refund_key,refund_reason,payment_refund_id,refunded_amount,failure_reason) VALUES
    (100,'owner','esimaccess','p1','Pending refund',7,50000,'RUB','xhub','paid','refund_pending','pay-100','00000000-0000-4000-8000-000000000100','Customer request',NULL,NULL,NULL),
    (101,'owner','esimaccess','p2','Completed refund',7,1099,'USD','cardlink','refunded','issued','bill-101','00000000-0000-4000-8000-000000000101',NULL,'ref-101',1099,NULL),
    (102,'owner','esimaccess','p3','Reversed refund',7,50000,'RUB','xhub','paid','refund_required','pay-102','00000000-0000-4000-8000-000000000102','Customer request','ref-102',NULL,'topup_refund_reversed'),
    (103,'owner','esimaccess','p4','Normal order',7,1099,'USD','cardlink','paid','issued','bill-103','00000000-0000-4000-8000-000000000103',NULL,NULL,NULL,NULL),
    (104,'owner','esimaccess','p5','Manual review',7,50000,'RUB','xhub','paid','refund_required','pay-104','00000000-0000-4000-8000-000000000104','Top-up unavailable',NULL,NULL,'topup_outcome_unknown');
  `);
  await sql(
    await Bun.file(`prisma/migrations/${migration}/migration.sql`).text(),
  );
  const address = await command(["docker", "port", name, "5432/tcp"]);
  client = new PrismaClient({
    datasources: {
      db: { url: `postgresql://postgres:local-test-only@${address}/postgres` },
    },
  });
  const migrated = await client.refund.findMany({
    orderBy: { orderId: "asc" },
  });
  assert.deepEqual(
    migrated.map((refund) => [refund.orderId, refund.status]),
    [
      [100n, "processing"],
      [101n, "completed"],
      [102n, "reversed"],
      [104n, "manual_review"],
    ],
  );
  assert.equal(
    migrated[0]?.idempotencyKey,
    "00000000-0000-4000-8000-000000000100",
  );
  assert.equal(migrated[1]?.providerRefundId, "ref-101");
  assert.equal(migrated[1]?.amount, 1099n);
  assert(
    migrated.every(
      (refund) => refund.source === "legacy" && refund.requestedById === null,
    ),
  );
  const create = {
    orderId: 103n,
    provider: "cardlink",
    providerPaymentId: "bill-103",
    amount: 1099n,
    currency: "USD",
    reason: "Customer request",
    source: "dashboard",
  };
  const concurrent = await Promise.all(
    Array.from({ length: 8 }, () =>
      client!.refund.upsert({
        where: { orderId: 103n },
        update: { orderId: 103n },
        create,
      }),
    ),
  );
  assert.equal(new Set(concurrent.map((refund) => refund.id)).size, 1);
  assert.equal(
    new Set(concurrent.map((refund) => refund.idempotencyKey)).size,
    1,
  );
  await assert.rejects(client.refund.create({ data: create }));
  await assert.rejects(
    client.refund.update({
      where: { orderId: 103n },
      data: { status: "invalid" },
    }),
  );
  await assert.rejects(
    client.refund.update({ where: { orderId: 103n }, data: { amount: 0n } }),
  );
  const localClient = client;
  await assert.rejects(
    client.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: 103n },
        data: { refundedAmount: 1099n },
      });
      await tx.refund.update({
        where: { orderId: 103n },
        data: { status: "invalid" },
      });
    }),
  );
  assert.equal(
    (await localClient.order.findUniqueOrThrow({ where: { id: 103n } }))
      .refundedAmount,
    null,
  );
  await client.user.create({
    data: { id: "staff", name: "Staff", email: "staff@example.test" },
  });
  await client.refund.update({
    where: { orderId: 103n },
    data: { requestedById: "staff" },
  });
  await client.user.delete({ where: { id: "staff" } });
  assert.equal(
    (await client.refund.findUniqueOrThrow({ where: { orderId: 103n } }))
      .requestedById,
    null,
  );
  const oldColumns = await client.$queryRaw<
    { column_name: string }[]
  >`SELECT column_name FROM information_schema.columns WHERE table_name = 'orders' AND column_name IN ('payment_refund_id','payment_refund_key','refund_reason')`;
  assert.equal(oldColumns.length, 0);
  console.log(
    "Refund migration verified: historical backfill, idempotency, concurrent upserts, constraints, atomic rollback, and requester deletion.",
  );
} finally {
  await client?.$disconnect();
  await command(["docker", "stop", name]).catch(() => undefined);
}
