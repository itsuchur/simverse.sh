import "server-only";

import * as Sentry from "@sentry/nextjs";

import {
  needsActivationFallback,
  projectEsimSnapshot,
  type EsimSnapshotEvent,
  type EsimSnapshotState,
} from "~/lib/esim-lifecycle";
import { paymentStatus } from "~/lib/order-status";
import { db } from "~/server/db";
import { findOrderForEsimWebhook } from "~/server/orders/fulfill";
import { queryEsimAccessProfiles } from "~/server/suppliers/esimaccess/order";

type LifecycleRow = {
  id: bigint;
  orderUuid: string;
  resellerOrderId: string | null;
  esimIccid: string | null;
  esimStatus: string | null;
  esimSmdpStatus: string | null;
  firstActivatedAt: Date | null;
  dataTotalBytes: bigint | null;
  dataUsedBytes: bigint | null;
  expiresAt: Date | null;
  usageSyncedAt: Date | null;
  webhookHistoryAppliedAt: Date | null;
  activationCheckedAt: Date | null;
};

type StoredWebhook = {
  payload: unknown;
  receivedAt: Date;
};

function toState(order: LifecycleRow): EsimSnapshotState {
  return {
    esimStatus: order.esimStatus,
    esimSmdpStatus: order.esimSmdpStatus,
    firstActivatedAt: order.firstActivatedAt,
    dataTotalBytes: order.dataTotalBytes,
    dataUsedBytes: order.dataUsedBytes,
    expiresAt: order.expiresAt,
    usageSyncedAt: order.usageSyncedAt,
  };
}

function contentRecord(payload: unknown): Record<string, unknown> | null {
  if (!payload || typeof payload !== "object") return null;
  const content = (payload as Record<string, unknown>).content;
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return null;
  }
  return content as Record<string, unknown>;
}

function contentString(
  content: Record<string, unknown>,
  key: string,
): string | null {
  const value = content[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function contentNumber(
  content: Record<string, unknown>,
  key: string,
): number | null {
  const value = content[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function eventFromLog(
  payload: unknown,
  observedAt: Date,
): { event: EsimSnapshotEvent; iccid: string | null } | null {
  if (!payload || typeof payload !== "object") return null;
  const notifyType = (payload as Record<string, unknown>).notifyType;
  const content = contentRecord(payload);
  if (!content) return null;
  const esimStatus = contentString(content, "esimStatus");
  const smdpStatus = contentString(content, "smdpStatus");
  const iccid = contentString(content, "iccid");

  if (notifyType === "DATA_USAGE") {
    return {
      iccid,
      event: {
        source: "data_usage",
        observedAt,
        esimStatus,
        smdpStatus,
        totalVolume: contentNumber(content, "totalVolume"),
        orderUsage: contentNumber(content, "orderUsage"),
        remain: contentNumber(content, "remain"),
      },
    };
  }
  if (notifyType === "VALIDITY_USAGE") {
    return {
      iccid,
      event: {
        source: "validity_usage",
        observedAt,
        esimStatus,
        smdpStatus,
        expiredTime: contentString(content, "expiredTime"),
      },
    };
  }
  if (notifyType === "ESIM_STATUS" || notifyType === "SMDP_EVENT") {
    return {
      iccid,
      event: {
        source: "status",
        observedAt,
        esimStatus,
        smdpStatus,
        totalVolume: contentNumber(content, "totalVolume"),
        orderUsage: contentNumber(content, "orderUsage"),
      },
    };
  }
  return null;
}

async function persistSnapshot(
  order: LifecycleRow,
  event: EsimSnapshotEvent,
  iccid: string | null,
): Promise<LifecycleRow> {
  const patch = projectEsimSnapshot(toState(order), event);
  const data = {
    ...patch,
    ...(iccid && !order.esimIccid ? { esimIccid: iccid } : {}),
  };
  if (Object.keys(data).length === 0) return order;
  return db.order.update({ where: { id: order.id }, data });
}

export async function recordEsimSnapshot(input: {
  iccid: string | null;
  orderNo: string | null;
  transactionId: string | null;
  event: EsimSnapshotEvent;
}): Promise<void> {
  const order = await findOrderForEsimWebhook(input);
  if (!order) return;
  await persistSnapshot(order, input.event, input.iccid);
}

async function replayEsimWebhookHistory(
  order: LifecycleRow,
): Promise<LifecycleRow> {
  const matchers: Array<{
    payload: { path: string[]; equals: string };
  }> = [];
  if (order.esimIccid) {
    matchers.push({
      payload: { path: ["content", "iccid"], equals: order.esimIccid },
    });
  }
  if (order.resellerOrderId) {
    matchers.push({
      payload: { path: ["content", "orderNo"], equals: order.resellerOrderId },
    });
  }
  matchers.push({
    payload: { path: ["content", "transactionId"], equals: order.orderUuid },
  });

  const logs: StoredWebhook[] = await db.webhookLog.findMany({
    where: { source: "esimaccess", OR: matchers },
    orderBy: { receivedAt: "asc" },
  });

  let current = order;
  for (const log of logs) {
    const parsed = eventFromLog(log.payload, log.receivedAt);
    if (!parsed) continue;
    current = await persistSnapshot(current, parsed.event, parsed.iccid);
  }

  return db.order.update({
    where: { id: order.id },
    data: { webhookHistoryAppliedAt: new Date() },
  });
}

async function runActivationFallback(order: LifecycleRow): Promise<void> {
  if (!order.resellerOrderId) return;

  let profiles: Awaited<ReturnType<typeof queryEsimAccessProfiles>>;
  try {
    profiles = await queryEsimAccessProfiles(order.resellerOrderId);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { component: "esimaccess", reason: "activation_check_failed" },
      extra: { orderId: order.id.toString() },
    });
    return;
  }

  const observedAt = new Date();
  const profile = profiles[0];
  if (!profile) {
    await db.order.update({
      where: { id: order.id },
      data: { activationCheckedAt: observedAt },
    });
    return;
  }

  const patch = projectEsimSnapshot(toState(order), {
    source: "query",
    observedAt,
    esimStatus: profile.esimStatus ?? null,
    smdpStatus: profile.smdpStatus ?? null,
    activateTime: profile.activateTime,
    expiredTime: profile.expiredTime,
    totalVolume: profile.totalVolume,
    orderUsage: profile.orderUsage,
  });
  await db.order.update({
    where: { id: order.id },
    data: {
      ...patch,
      activationCheckedAt: observedAt,
      ...(!order.esimIccid ? { esimIccid: profile.iccid } : {}),
    },
  });
}

export async function syncEsimLifecycleForUser(userId: string): Promise<void> {
  const orders = await db.order.findMany({
    where: {
      userId,
      resellerCode: "esimaccess",
      paymentStatus: paymentStatus.paid,
      OR: [{ esimIccid: { not: null } }, { resellerOrderId: { not: null } }],
    },
  });

  for (const order of orders) {
    let current: LifecycleRow = order;
    if (!current.webhookHistoryAppliedAt) {
      current = await replayEsimWebhookHistory(current);
    }
    if (needsActivationFallback(current, new Date())) {
      await runActivationFallback(current);
    }
  }
}
