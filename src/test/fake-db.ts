import type { Refund } from "@prisma/client";
/**
 * In-memory stand-in for the Prisma client, covering only the query shapes
 * used by the order fulfillment code (`src/server/orders/*`) and the webhook
 * logger. Installed via `mock.module("~/server/db", ...)` in setup.ts.
 */

export type FakeUser = {
  email: string;
  isBanned: boolean;
  banReason: string | null;
  id: string;
  telegramId: string | null;
  languageCode: string | null;
  preferredLanguage: string | null;
  dataUsageNotifications: boolean;
  acquisitionSource: string | null;
  createdAt: Date;
};

export type FakeExcludedPackageCode = {
  id: bigint;
  resellerCode: string;
  packageCode: string;
  createdAt: Date;
  updatedAt: Date;
};

export type FakeExcludedCountryCode = {
  id: bigint;
  resellerCode: string;
  countryCode: string;
  createdAt: Date;
  updatedAt: Date;
};

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
  buyerIp: string | null;
  paymentInvoiceUrl: string | null;
  paymentInvoiceId: string | null;
  paymentNextCheckAt: Date;
  paymentInvoiceClaim: string | null;
  cartRevision: string | null;
  paymentStatus: string;
  paymentChargeId: string | null;
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
  firstActivatedAt: Date | null;
  dataTotalBytes: bigint | null;
  dataUsedBytes: bigint | null;
  expiresAt: Date | null;
  usageSyncedAt: Date | null;
  webhookHistoryAppliedAt: Date | null;
  activationCheckedAt: Date | null;
  topupOfOrderId: bigint | null;
  topupPeriodDays: number | null;
  promoCodeId: bigint | null;
  paidAt: Date | null;
  issuedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FakePromoCode = {
  id: bigint;
  code: string;
  discountPercent: number;
  maxPerUser: number | null;
  maxRedemptions: number | null;
  startsAt: Date;
  endsAt: Date | null;
  note: string | null;
  revokedAt: Date | null;
  revokedById: string | null;
  revokeReason: string | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type FakePromoRedemption = {
  id: bigint;
  promoCodeId: bigint;
  userId: string;
  orderId: bigint;
  oncePerUser: boolean;
  discountPercent: number;
  listPriceAmount: bigint;
  chargedAmount: bigint;
  currency: string;
  consumedAt: Date | null;
  releasedAt: Date | null;
  createdAt: Date;
};

type Where = Record<string, unknown>;

type OrderQueryArgs = {
  where: Where;
  data?: Record<string, unknown>;
  include?: { user?: { select?: { telegramId?: boolean } } };
  orderBy?: { createdAt?: "asc" | "desc"; updatedAt?: "asc" | "desc" };
  take?: number;
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
    if (["lt", "gt", "gte", "lte"].some((key) => key in cond)) {
      return (
        actual instanceof Date &&
        (!("gt" in cond) || (cond.gt instanceof Date && actual > cond.gt)) &&
        (!("lt" in cond) || (cond.lt instanceof Date && actual < cond.lt)) &&
        (!("gte" in cond) ||
          (cond.gte instanceof Date && actual >= cond.gte)) &&
        (!("lte" in cond) || (cond.lte instanceof Date && actual <= cond.lte))
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

function matchWhere(record: object, where: Where): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (condition === undefined) {
      return true;
    }
    if (key === "OR") {
      return (condition as Where[]).some((sub) => matchWhere(record, sub));
    }
    if (key === "AND") {
      return (condition as Where[]).every((sub) => matchWhere(record, sub));
    }
    return matchValue((record as Record<string, unknown>)[key], condition);
  });
}

function orderDefaults(): Omit<
  FakeOrder,
  "id" | "orderUuid" | "createdAt" | "updatedAt"
> {
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
    buyerIp: null,
    paymentInvoiceUrl: null,
    paymentInvoiceId: null,
    paymentNextCheckAt: new Date(0),
    paymentInvoiceClaim: null,
    cartRevision: null,
    paymentStatus: "pending",
    paymentChargeId: null,
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
    firstActivatedAt: null,
    dataTotalBytes: null,
    dataUsedBytes: null,
    expiresAt: null,
    usageSyncedAt: null,
    webhookHistoryAppliedAt: null,
    activationCheckedAt: null,
    topupOfOrderId: null,
    topupPeriodDays: null,
    promoCodeId: null,
    paidAt: null,
    issuedAt: null,
  };
}

class FakeDb {
  private orders: FakeOrder[] = [];
  private refunds: Refund[] = [];
  private transactionQueue: Promise<void> = Promise.resolve();
  private excludedPackageCodes: FakeExcludedPackageCode[] = [];
  private excludedCountryCodes: FakeExcludedCountryCode[] = [];
  private users = new Map<string, FakeUser>();
  private promoCodes: FakePromoCode[] = [];
  private promoRedemptions: FakePromoRedemption[] = [];
  private nextPromoCodeId = 1n;
  private nextPromoRedemptionId = 1n;
  private telegramStarts: Array<{
    telegramId: string;
    firstSource: string;
    latestSource: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> = [];
  private nextOrderId = 1n;
  private nextExcludedPackageCodeId = 1n;
  private nextExcludedCountryCodeId = 1n;
  private nextWebhookLogId = 1n;

  webhookLogs: Array<{
    id: bigint;
    source: string;
    headers: unknown;
    payload?: unknown;
    receivedAt: Date;
  }> = [];

  reset() {
    this.orders = [];
    this.refunds = [];
    this.excludedPackageCodes = [];
    this.excludedCountryCodes = [];
    this.users.clear();
    this.telegramStarts = [];
    this.webhookLogs = [];
    this.promoCodes = [];
    this.promoRedemptions = [];
    this.nextOrderId = 1n;
    this.nextPromoCodeId = 1n;
    this.nextPromoRedemptionId = 1n;
    this.nextExcludedPackageCodeId = 1n;
    this.nextExcludedCountryCodeId = 1n;
    this.nextWebhookLogId = 1n;
  }

  refundForOrder(orderId: bigint): Refund | null {
    return this.refunds.find((refund) => refund.orderId === orderId) ?? null;
  }

  seedRefund(input: Partial<Refund> & { orderId: bigint }): Refund {
    const order = this.orders.find((order) => order.id === input.orderId)!;
    const record: Refund = {
      id: crypto.randomUUID(),
      provider: order.paymentProvider,
      providerPaymentId: order.paymentChargeId,
      providerRefundId: null,
      idempotencyKey: crypto.randomUUID(),
      amount: order.priceAmount,
      currency: order.currency,
      status: "requested",
      providerStatus: null,
      reason: "Customer request",
      source: "automatic",
      requestedById: null,
      failureCode: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      completedAt: null,
      ...input,
    };
    this.refunds.push(record);
    return record;
  }

  async $executeRaw(_query: TemplateStringsArray) {
    // Transactions below already serialize the invoice advisory lock in tests.
    return 1;
  }

  async $transaction<T>(run: (tx: FakeDb) => Promise<T>): Promise<T> {
    const previous = this.transactionQueue;
    let release!: () => void;
    this.transactionQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    const orderStates = this.orders.map((row) => ({ row, state: { ...row } }));
    const refundStates = this.refunds.map((row) => ({
      row,
      state: { ...row },
    }));
    const promoCodeStates = this.promoCodes.map((row) => ({
      row,
      state: { ...row },
    }));
    const redemptionStates = this.promoRedemptions.map((row) => ({
      row,
      state: { ...row },
    }));
    try {
      return await run(this);
    } catch (error) {
      orderStates.forEach(({ row, state }) => Object.assign(row, state));
      refundStates.forEach(({ row, state }) => Object.assign(row, state));
      promoCodeStates.forEach(({ row, state }) => Object.assign(row, state));
      redemptionStates.forEach(({ row, state }) => Object.assign(row, state));
      this.orders = orderStates.map(({ row }) => row);
      this.refunds = refundStates.map(({ row }) => row);
      this.promoCodes = promoCodeStates.map(({ row }) => row);
      this.promoRedemptions = redemptionStates.map(({ row }) => row);
      throw error;
    } finally {
      release();
    }
  }

  async $queryRaw(query: { strings?: readonly string[]; values?: unknown[] }) {
    const text = query.strings?.join(" ") ?? "";
    if (text.includes("promo_codes") && text.includes("FOR UPDATE")) {
      const code = query.values?.find((value) => typeof value === "string");
      const row = this.promoCodes.find((item) => item.code === code);
      return row ? [{ id: row.id }] : [];
    }
    throw new Error("fake-db: unsupported $queryRaw");
  }

  refund = {
    findUnique: async (args: { where: Where }) =>
      this.refunds.find((row) => matchWhere(row, args.where)) ?? null,
    findUniqueOrThrow: async (args: { where: Where }) => {
      const row = this.refunds.find((row) => matchWhere(row, args.where));
      if (!row) throw new Error("Refund not found");
      return { ...row };
    },
    upsert: async (args: {
      where: Where;
      create: Partial<Refund> & { orderId: bigint };
      update: Partial<Refund>;
    }) => {
      const row = this.refunds.find((row) => matchWhere(row, args.where));
      if (row) return { ...row };
      return { ...this.seedRefund(args.create) };
    },
    update: async (args: { where: Where; data: Partial<Refund> }) => {
      const row = this.refunds.find((row) => matchWhere(row, args.where));
      if (!row) throw new Error("Refund not found");
      Object.assign(row, args.data, { updatedAt: new Date() });
      return { ...row };
    },
    updateMany: async (args: { where: Where; data: Partial<Refund> }) => {
      const rows = this.refunds.filter((row) => matchWhere(row, args.where));
      rows.forEach((row) =>
        Object.assign(row, args.data, { updatedAt: new Date() }),
      );
      return { count: rows.length };
    },
  };

  seedUser(user: Partial<FakeUser> & { id: string }): FakeUser {
    const record: FakeUser = {
      email: `${user.id}@telegram.local`,
      isBanned: false,
      banReason: null,
      telegramId: null,
      languageCode: null,
      preferredLanguage: null,
      dataUsageNotifications: true,
      acquisitionSource: null,
      createdAt: new Date(),
      ...user,
    };
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

  seedWebhookLog(input: {
    source?: string;
    payload: unknown;
    receivedAt: Date;
  }) {
    const record = {
      id: this.nextWebhookLogId++,
      source: input.source ?? "esimaccess",
      headers: {},
      payload: input.payload,
      receivedAt: input.receivedAt,
    };
    this.webhookLogs.push(record);
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

  private withInclude(
    record: FakeOrder,
    args: OrderQueryArgs & { select?: { user?: unknown } },
  ) {
    if (!args.include?.user && !args.select?.user) {
      return { ...record };
    }
    const user = this.users.get(record.userId);
    return {
      ...record,
      user: {
        telegramId: user?.telegramId ?? null,
        languageCode: user?.languageCode ?? null,
        preferredLanguage: user?.preferredLanguage ?? null,
        dataUsageNotifications: true,
        isBanned: false,
        isDeleted: false,
        acquisitionSource: user?.acquisitionSource ?? null,
      },
    };
  }

  /** Mirrors the partial unique index `uq_pending_draft` from the migration SQL. */
  private violatesPendingDraftIndex(candidate: FakeOrder) {
    if (
      candidate.paymentStatus !== "pending" ||
      candidate.status !== "created"
    ) {
      return false;
    }
    return this.orders.some(
      (order) =>
        order.paymentStatus === "pending" &&
        order.status === "created" &&
        order.userId === candidate.userId &&
        order.paymentProvider === candidate.paymentProvider &&
        order.resellerPlanId === candidate.resellerPlanId &&
        order.priceAmount === candidate.priceAmount &&
        order.currency === candidate.currency &&
        order.topupOfOrderId === candidate.topupOfOrderId &&
        order.topupPeriodDays === candidate.topupPeriodDays &&
        order.promoCodeId === candidate.promoCodeId,
    );
  }

  order = {
    create: async (args: { data: Partial<FakeOrder> }) => {
      const now = new Date();
      const record: FakeOrder = {
        id: this.nextOrderId++,
        orderUuid: crypto.randomUUID(),
        createdAt: now,
        updatedAt: now,
        ...orderDefaults(),
        ...args.data,
      };
      if (this.violatesPendingDraftIndex(record)) {
        throw Object.assign(new Error("Unique constraint failed"), {
          code: "P2002",
        });
      }
      this.orders.push(record);
      return record;
    },
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
    findMany: async (args: OrderQueryArgs) => {
      const matches = this.orders.filter((order) =>
        matchWhere(order, args.where),
      );
      if (args.orderBy?.updatedAt) {
        const direction = args.orderBy.updatedAt === "desc" ? -1 : 1;
        matches.sort((a, b) => {
          const byTime =
            direction * (a.updatedAt.getTime() - b.updatedAt.getTime());
          if (byTime !== 0) return byTime;
          if (a.id < b.id) return -1;
          if (a.id > b.id) return 1;
          return 0;
        });
      }
      const limited =
        typeof args.take === "number" ? matches.slice(0, args.take) : matches;
      return limited.map((order) => ({ ...order }));
    },
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

  excludedPackageCode = {
    findMany: async (args: {
      where: { resellerCode: string };
      select?: { packageCode?: boolean };
    }) => {
      const rows = this.excludedPackageCodes.filter(
        (row) => row.resellerCode === args.where.resellerCode,
      );
      if (args.select?.packageCode) {
        return rows.map(({ packageCode }) => ({ packageCode }));
      }
      return rows;
    },
    findUnique: async (args: {
      where: {
        resellerCode_packageCode: {
          resellerCode: string;
          packageCode: string;
        };
      };
      select?: { id?: boolean };
    }) => {
      const key = args.where.resellerCode_packageCode;
      const row =
        this.excludedPackageCodes.find(
          (candidate) =>
            candidate.resellerCode === key.resellerCode &&
            candidate.packageCode === key.packageCode,
        ) ?? null;
      if (row && args.select?.id) {
        return { id: row.id };
      }
      return row;
    },
    upsert: async (args: {
      where: {
        resellerCode_packageCode: {
          resellerCode: string;
          packageCode: string;
        };
      };
      create: { resellerCode: string; packageCode: string };
      update: Record<string, never>;
    }) => {
      const key = args.where.resellerCode_packageCode;
      const existing = this.excludedPackageCodes.find(
        (candidate) =>
          candidate.resellerCode === key.resellerCode &&
          candidate.packageCode === key.packageCode,
      );
      if (existing) {
        return existing;
      }
      const now = new Date();
      const row: FakeExcludedPackageCode = {
        id: this.nextExcludedPackageCodeId++,
        ...args.create,
        createdAt: now,
        updatedAt: now,
      };
      this.excludedPackageCodes.push(row);
      return row;
    },
    deleteMany: async (args: {
      where: { resellerCode: string; packageCode: string };
    }) => {
      const previousLength = this.excludedPackageCodes.length;
      this.excludedPackageCodes = this.excludedPackageCodes.filter(
        (row) =>
          row.resellerCode !== args.where.resellerCode ||
          row.packageCode !== args.where.packageCode,
      );
      return { count: previousLength - this.excludedPackageCodes.length };
    },
  };

  excludedCountryCode = {
    findMany: async (args: {
      where: { resellerCode: string };
      select?: { countryCode?: boolean };
    }) => {
      const rows = this.excludedCountryCodes.filter(
        (row) => row.resellerCode === args.where.resellerCode,
      );
      if (args.select?.countryCode) {
        return rows.map(({ countryCode }) => ({ countryCode }));
      }
      return rows;
    },
    findUnique: async (args: {
      where: {
        resellerCode_countryCode: {
          resellerCode: string;
          countryCode: string;
        };
      };
      select?: { id?: boolean };
    }) => {
      const key = args.where.resellerCode_countryCode;
      const row =
        this.excludedCountryCodes.find(
          (candidate) =>
            candidate.resellerCode === key.resellerCode &&
            candidate.countryCode === key.countryCode,
        ) ?? null;
      if (row && args.select?.id) {
        return { id: row.id };
      }
      return row;
    },
    upsert: async (args: {
      where: {
        resellerCode_countryCode: {
          resellerCode: string;
          countryCode: string;
        };
      };
      create: { resellerCode: string; countryCode: string };
      update: Record<string, never>;
    }) => {
      const key = args.where.resellerCode_countryCode;
      const existing = this.excludedCountryCodes.find(
        (candidate) =>
          candidate.resellerCode === key.resellerCode &&
          candidate.countryCode === key.countryCode,
      );
      if (existing) {
        return existing;
      }
      const now = new Date();
      const row: FakeExcludedCountryCode = {
        id: this.nextExcludedCountryCodeId++,
        ...args.create,
        createdAt: now,
        updatedAt: now,
      };
      this.excludedCountryCodes.push(row);
      return row;
    },
    deleteMany: async (args: {
      where: { resellerCode: string; countryCode: string };
    }) => {
      const previousLength = this.excludedCountryCodes.length;
      this.excludedCountryCodes = this.excludedCountryCodes.filter(
        (row) =>
          row.resellerCode !== args.where.resellerCode ||
          row.countryCode !== args.where.countryCode,
      );
      return { count: previousLength - this.excludedCountryCodes.length };
    },
  };

  telegramStart = {
    findUnique: async (args: { where: { telegramId: string } }) => {
      const row = this.telegramStarts.find(
        (item) => item.telegramId === args.where.telegramId,
      );
      return row ? { ...row } : null;
    },
    upsert: async (args: {
      where: { telegramId: string };
      create: {
        telegramId: string;
        firstSource: string;
        latestSource: string;
      };
      update: { latestSource: string };
    }) => {
      const row = this.telegramStarts.find(
        (item) => item.telegramId === args.where.telegramId,
      );
      if (row) {
        row.latestSource = args.update.latestSource;
        row.updatedAt = new Date();
        return { ...row };
      }
      const created = {
        ...args.create,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.telegramStarts.push(created);
      return { ...created };
    },
    updateMany: async (args: {
      where: { telegramId: string; latestSource: string };
      data: { latestSource: string | null };
    }) => {
      const rows = this.telegramStarts.filter(
        (item) =>
          item.telegramId === args.where.telegramId &&
          item.latestSource === args.where.latestSource,
      );
      for (const row of rows) {
        row.latestSource = args.data.latestSource;
        row.updatedAt = new Date();
      }
      return { count: rows.length };
    },
  };

  user = {
    update: async (args: {
      where: { id: string };
      data: Partial<FakeUser>;
    }) => {
      const user = this.users.get(args.where.id);
      if (!user) throw new Error("User not found");
      Object.assign(user, args.data);
      return { ...user };
    },
    findUnique: async (args: {
      where: { id?: string; telegramId?: string };
      select?: Record<string, boolean>;
    }) => {
      let user: FakeUser | undefined;
      if (args.where.id !== undefined) {
        user = this.users.get(args.where.id);
      } else if (args.where.telegramId !== undefined) {
        user = [...this.users.values()].find(
          (row) => row.telegramId === args.where.telegramId,
        );
      }
      if (!user) return null;
      if (!args.select) {
        return { ...user };
      }
      const selected: Record<string, unknown> = {};
      for (const [key, enabled] of Object.entries(args.select)) {
        if (enabled) {
          selected[key] = user[key as keyof FakeUser];
        }
      }
      return selected;
    },
    updateMany: async (args: { where: Where; data: Partial<FakeUser> }) => {
      const matches = [...this.users.values()].filter((user) =>
        matchWhere(user, args.where),
      );
      for (const user of matches) {
        Object.assign(user, args.data);
      }
      return { count: matches.length };
    },
  };

  promoCode = {
    findUnique: async (args: { where: { id?: bigint; code?: string } }) => {
      const row = this.promoCodes.find((item) =>
        args.where.id !== undefined
          ? item.id === args.where.id
          : item.code === args.where.code,
      );
      return row ? { ...row } : null;
    },
    findMany: async (args?: {
      orderBy?: { createdAt?: "asc" | "desc" };
      include?: {
        _count?: {
          select?: { redemptions?: { where?: Where } };
        };
      };
    }) => {
      const rows = [...this.promoCodes];
      if (args?.orderBy?.createdAt === "desc") {
        rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      return rows.map((row) => ({
        ...row,
        _count: {
          redemptions: this.promoRedemptions.filter(
            (redemption) =>
              redemption.promoCodeId === row.id &&
              matchWhere(
                redemption,
                args?.include?._count?.select?.redemptions?.where ?? {},
              ),
          ).length,
        },
      }));
    },
    create: async (args: {
      data: Omit<FakePromoCode, "id" | "createdAt" | "updatedAt">;
    }) => {
      if (this.promoCodes.some((item) => item.code === args.data.code)) {
        throw Object.assign(new Error("Unique constraint failed"), {
          code: "P2002",
        });
      }
      const now = new Date();
      const row: FakePromoCode = {
        id: this.nextPromoCodeId++,
        ...args.data,
        createdAt: now,
        updatedAt: now,
      };
      this.promoCodes.push(row);
      return { ...row };
    },
    update: async (args: {
      where: { id: bigint };
      data: Partial<FakePromoCode>;
    }) => {
      const row = this.promoCodes.find((item) => item.id === args.where.id);
      if (!row) throw new Error("fake-db: promo code not found");
      Object.assign(row, args.data, { updatedAt: new Date() });
      return { ...row };
    },
  };

  promoRedemption = {
    findFirst: async (args: { where: Where }) => {
      const row = this.promoRedemptions.find((item) =>
        matchWhere(item, args.where),
      );
      return row ? { ...row } : null;
    },
    findMany: async (args: { where?: Where } = {}) =>
      this.promoRedemptions
        .filter((item) => matchWhere(item, args.where ?? {}))
        .map((item) => ({ ...item })),
    count: async (args: { where: Where }) =>
      this.promoRedemptions.filter((item) => matchWhere(item, args.where))
        .length,
    create: async (args: {
      data: Omit<
        FakePromoRedemption,
        "id" | "createdAt" | "consumedAt" | "releasedAt"
      > & {
        consumedAt?: Date | null;
        releasedAt?: Date | null;
      };
    }) => {
      const row: FakePromoRedemption = {
        id: this.nextPromoRedemptionId++,
        consumedAt: null,
        releasedAt: null,
        createdAt: new Date(),
        ...args.data,
      };
      if (
        row.oncePerUser &&
        row.releasedAt == null &&
        this.promoRedemptions.some(
          (item) =>
            item.oncePerUser &&
            item.releasedAt == null &&
            item.promoCodeId === row.promoCodeId &&
            item.userId === row.userId,
        )
      ) {
        throw Object.assign(new Error("Unique constraint failed"), {
          code: "P2002",
        });
      }
      if (this.promoRedemptions.some((item) => item.orderId === row.orderId)) {
        throw Object.assign(new Error("Unique constraint failed"), {
          code: "P2002",
        });
      }
      this.promoRedemptions.push(row);
      return { ...row };
    },
    updateMany: async (args: {
      where: Where;
      data: Partial<FakePromoRedemption>;
    }) => {
      const matches = this.promoRedemptions.filter((item) =>
        matchWhere(item, args.where),
      );
      for (const row of matches) {
        Object.assign(row, args.data);
      }
      return { count: matches.length };
    },
  };

  webhookLog = {
    create: async (args: {
      data: { source: string; headers: unknown; payload?: unknown };
    }) => {
      const record = {
        id: this.nextWebhookLogId++,
        source: args.data.source,
        headers: args.data.headers,
        payload: args.data.payload,
        receivedAt: new Date(),
      };
      this.webhookLogs.push(record);
      return record;
    },
    findMany: async (args: {
      where: {
        source: string;
        OR: Array<{ payload: { path: string[]; equals: string } }>;
      };
      orderBy?: { receivedAt?: "asc" | "desc" };
    }) => {
      const matches = this.webhookLogs.filter((log) => {
        if (log.source !== args.where.source) return false;
        return args.where.OR.some((clause) => {
          let value: unknown = log.payload;
          for (const key of clause.payload.path) {
            if (!value || typeof value !== "object") return false;
            value = (value as Record<string, unknown>)[key];
          }
          return value === clause.payload.equals;
        });
      });
      const direction = args.orderBy?.receivedAt === "desc" ? -1 : 1;
      matches.sort(
        (a, b) => direction * (a.receivedAt.getTime() - b.receivedAt.getTime()),
      );
      return matches.map((log) => ({ ...log }));
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
