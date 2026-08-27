/**
 * In-memory stand-in for the Prisma client, covering only the query shapes
 * used by the order fulfillment code (`src/server/orders/*`) and the webhook
 * logger. Installed via `mock.module("~/server/db", ...)` in setup.ts.
 */

export type FakeUser = { id: string; telegramId: string | null };

export type FakeOrder = {
  id: bigint;
  orderUuid: string;
  userId: string;
  resellerCode: string;
  resellerPlanId: string;
  resellerOrderId: string | null;
  resellerRawResponse: unknown;
  packageName: string;
  countryCode: string | null;
  dataAmountMb: number;
  validityDays: number;
  priceAmount: bigint;
  currency: string;
  costAmount: bigint;
  costCurrency: string;
  paymentProvider: string;
  paymentStatus: string;
  paymentChargeId: string | null;
  paymentRefundId: string | null;
  paymentChargebackId: string | null;
  refundedAmount: bigint | null;
  status: string;
  failureReason: string | null;
  esimIccid: string | null;
  esimStatus: string | null;
  esimSmdpStatus: string | null;
  esimActivationCode: string | null;
  esimQrUrl: string | null;
  esimSmdpAddress: string | null;
  paidAt: Date | null;
  issuedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type Where = Record<string, unknown>;

type OrderQueryArgs = {
  where: Where;
  data?: Record<string, unknown>;
  include?: { user?: { select?: { telegramId?: boolean } } };
  orderBy?: { createdAt?: "asc" | "desc" };
};

function matchValue(actual: unknown, condition: unknown): boolean {
  if (
    condition !== null &&
    typeof condition === "object" &&
    !(condition instanceof Date) &&
    !Array.isArray(condition)
  ) {
    const cond = condition as Record<string, unknown>;
    if ("in" in cond) {
      return (cond.in as unknown[]).includes(actual);
    }
    if ("not" in cond) {
      return actual !== cond.not;
    }
    if ("lt" in cond) {
      return (
        actual instanceof Date &&
        cond.lt instanceof Date &&
        actual.getTime() < cond.lt.getTime()
      );
    }
    throw new Error(
      `fake-db: unsupported where condition ${JSON.stringify(condition)}`,
    );
  }
  if (actual instanceof Date && condition instanceof Date) {
    return actual.getTime() === condition.getTime();
  }
  return actual === condition;
}

function matchWhere(record: FakeOrder, where: Where): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (condition === undefined) {
      return true;
    }
    if (key === "OR") {
      return (condition as Where[]).some((sub) => matchWhere(record, sub));
    }
    return matchValue((record as Record<string, unknown>)[key], condition);
  });
}

function orderDefaults(): Omit<FakeOrder, "id" | "orderUuid" | "createdAt" | "updatedAt"> {
  return {
    userId: "user-1",
    resellerCode: "esimaccess",
    resellerPlanId: "PKG-TEST",
    resellerOrderId: null,
    resellerRawResponse: null,
    packageName: "Test 1GB 7Days",
    countryCode: "US",
    dataAmountMb: 1024,
    validityDays: 7,
    priceAmount: 1099n,
    currency: "USD",
    costAmount: 500n,
    costCurrency: "USD",
    paymentProvider: "trybit",
    paymentStatus: "pending",
    paymentChargeId: null,
    paymentRefundId: null,
    paymentChargebackId: null,
    refundedAmount: null,
    status: "created",
    failureReason: null,
    esimIccid: null,
    esimStatus: null,
    esimSmdpStatus: null,
    esimActivationCode: null,
    esimQrUrl: null,
    esimSmdpAddress: null,
    paidAt: null,
    issuedAt: null,
  };
}

class FakeDb {
  private orders: FakeOrder[] = [];
  private users = new Map<string, FakeUser>();
  private nextOrderId = 1n;

  webhookLogs: Array<{ source: string; headers: unknown; payload?: unknown }> =
    [];

  reset() {
    this.orders = [];
    this.users.clear();
    this.webhookLogs = [];
    this.nextOrderId = 1n;
  }

  seedUser(user: { id: string; telegramId?: string | null }): FakeUser {
    const record: FakeUser = { telegramId: null, ...user };
    this.users.set(record.id, record);
    return record;
  }

  seedOrder(input: Partial<FakeOrder> = {}): FakeOrder {
    const now = new Date();
    const record: FakeOrder = {
      id: this.nextOrderId++,
      orderUuid: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...orderDefaults(),
      ...input,
    };
    this.orders.push(record);
    return record;
  }

  /** Live record; mutations by the code under test are visible on it. */
  orderByUuid(orderUuid: string): FakeOrder | null {
    return this.orders.find((order) => order.orderUuid === orderUuid) ?? null;
  }

  private findByUniqueWhere(where: Where): FakeOrder | null {
    if ("id" in where) {
      return this.orders.find((order) => order.id === where.id) ?? null;
    }
    if ("orderUuid" in where) {
      return (
        this.orders.find((order) => order.orderUuid === where.orderUuid) ?? null
      );
    }
    throw new Error(
      `fake-db: unsupported unique where ${JSON.stringify(where)}`,
    );
  }

  private applyData(record: FakeOrder, data: Record<string, unknown>) {
    const target = record as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(data)) {
      if (value === undefined) {
        continue;
      }
      target[key] = value;
    }
    if (data.updatedAt === undefined) {
      record.updatedAt = new Date();
    }
  }

  private withInclude(record: FakeOrder, args: OrderQueryArgs) {
    if (!args.include?.user) {
      return record;
    }
    return {
      ...record,
      user: { telegramId: this.users.get(record.userId)?.telegramId ?? null },
    };
  }

  order = {
    findUnique: async (args: OrderQueryArgs) => {
      const found = this.findByUniqueWhere(args.where);
      return found ? this.withInclude(found, args) : null;
    },
    findUniqueOrThrow: async (args: OrderQueryArgs) => {
      const found = this.findByUniqueWhere(args.where);
      if (!found) {
        throw new Error("fake-db: no Order found");
      }
      return this.withInclude(found, args);
    },
    findFirst: async (args: OrderQueryArgs) => {
      const matches = this.orders.filter((order) =>
        matchWhere(order, args.where),
      );
      if (args.orderBy?.createdAt) {
        const direction = args.orderBy.createdAt === "desc" ? -1 : 1;
        matches.sort(
          (a, b) => direction * (a.createdAt.getTime() - b.createdAt.getTime()),
        );
      }
      const first = matches[0];
      return first ? this.withInclude(first, args) : null;
    },
    findMany: async (args: OrderQueryArgs) =>
      this.orders.filter((order) => matchWhere(order, args.where)),
    update: async (args: OrderQueryArgs) => {
      const record = this.findByUniqueWhere(args.where);
      if (!record) {
        throw new Error("fake-db: record to update not found");
      }
      this.applyData(record, args.data ?? {});
      return this.withInclude(record, args);
    },
    updateMany: async (args: OrderQueryArgs) => {
      const matches = this.orders.filter((order) =>
        matchWhere(order, args.where),
      );
      for (const record of matches) {
        this.applyData(record, args.data ?? {});
      }
      return { count: matches.length };
    },
  };

  user = {
    findUnique: async (args: { where: { id: string } }) => {
      const user = this.users.get(args.where.id);
      return user ? { telegramId: user.telegramId } : null;
    },
  };

  webhookLog = {
    create: async (args: {
      data: { source: string; headers: unknown; payload?: unknown };
    }) => {
      this.webhookLogs.push(args.data);
      return args.data;
    },
  };
}

export const fakeDb = new FakeDb();

/** Mirrors the helper in src/server/db.ts. */
export function isUniqueConstraintError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "P2002"
  );
}
