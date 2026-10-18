import { isEsimLifecycleStatus } from "~/lib/esim-status";

/** How long an unconfirmed install waits before another activation query. */
export const ACTIVATION_CHECK_INTERVAL_MS = 30 * 60 * 1000;

const AMBIGUOUS_SMDP_STATUSES = new Set([
  "DOWNLOAD",
  "INSTALLATION",
  "ENABLED",
  "DISABLED",
]);

const NO_ACTIVATION_QUERY_STATUSES = new Set([
  "USED_UP",
  "USED_EXPIRED",
  "UNUSED_EXPIRED",
  "CANCEL",
  "REVOKED",
  "SUSPENDED",
]);

const KEEP_INSTALL_VISIBLE_STATUSES = new Set(["REVOKED", "SUSPENDED"]);

export type EsimSnapshotSource =
  | "status"
  | "data_usage"
  | "validity_usage"
  | "query";

export type EsimSnapshotState = {
  esimStatus: string | null;
  esimSmdpStatus: string | null;
  firstActivatedAt: Date | null;
  dataTotalBytes: bigint | null;
  dataUsedBytes: bigint | null;
  expiresAt: Date | null;
  usageSyncedAt: Date | null;
};

export type EsimSnapshotEvent = {
  source: EsimSnapshotSource;
  observedAt: Date;
  esimStatus?: string | null;
  smdpStatus?: string | null;
  /** Honored only for `source: "query"`. */
  activateTime?: string | null;
  totalVolume?: number | null;
  orderUsage?: number | null;
  /** Bytes remaining. Used only to complete a DATA_USAGE pair. */
  remain?: number | null;
  expiredTime?: string | null;
};

export type EsimSnapshotPatch = {
  esimStatus?: string;
  esimSmdpStatus?: string;
  firstActivatedAt?: Date;
  dataTotalBytes?: bigint;
  dataUsedBytes?: bigint;
  expiresAt?: Date;
  usageSyncedAt?: Date;
};

type ByteAmount = bigint | string | number | null;

export type ActivationEvidence = {
  esimStatus: string | null;
  firstActivatedAt: Date | string | null;
  dataUsedBytes: ByteAmount;
};

export type ActivationFallbackOrder = ActivationEvidence & {
  esimSmdpStatus: string | null;
  resellerOrderId: string | null;
  webhookHistoryAppliedAt: Date | string | null;
  activationCheckedAt: Date | string | null;
};

export type LifecycleOrder = {
  esimStatus: string | null;
  esimSmdpStatus: string | null;
  firstActivatedAt: string | null;
  dataTotalBytes: string | null;
  dataUsedBytes: string | null;
  expiresAt: string | null;
  usageSyncedAt: string | null;
};

export type LifecycleFocus =
  | { kind: "install" }
  | {
      kind: "remaining";
      remainingBytes: bigint;
      usageSyncedAt: string | null;
    }
  | { kind: "usageUnavailable"; usageSyncedAt: string | null }
  | { kind: "exhausted" }
  | { kind: "cancelled" }
  | {
      kind: "expired";
      unused: boolean;
      expiresAt: string | null;
      dataExhausted: boolean;
    };

export type LifecycleView = {
  collapseInstall: boolean;
  focus: LifecycleFocus;
};

function finiteByte(value: number | null | undefined): bigint | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return BigInt(Math.trunc(value));
}

/** Provider timestamps sometimes use `+0000` instead of `+00:00`. */
export function parseProviderTime(
  value: string | null | undefined,
): Date | null {
  if (!value) return null;
  const normalized = value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const time = Date.parse(normalized);
  if (!Number.isFinite(time)) return null;
  return new Date(time);
}

function asBigInt(value: ByteAmount): bigint | null {
  if (typeof value === "bigint") return value;
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return BigInt(Math.trunc(value));
  }
  if (typeof value !== "string" || value.length === 0) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function asTime(value: Date | string | null): number | null {
  if (value === null) return null;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function isActivationConfirmed(order: ActivationEvidence): boolean {
  if (order.firstActivatedAt) return true;
  const used = asBigInt(order.dataUsedBytes);
  if (used !== null && used > 0n) return true;
  return order.esimStatus === "USED_UP" || order.esimStatus === "USED_EXPIRED";
}

export function hasAmbiguousInstallSignal(order: {
  esimStatus: string | null;
  esimSmdpStatus: string | null;
}): boolean {
  return (
    order.esimStatus === "IN_USE" ||
    (order.esimSmdpStatus !== null &&
      AMBIGUOUS_SMDP_STATUSES.has(order.esimSmdpStatus))
  );
}

export function needsActivationFallback(
  order: ActivationFallbackOrder,
  now: Date,
): boolean {
  if (!order.webhookHistoryAppliedAt || !order.resellerOrderId) return false;
  if (
    order.esimStatus !== null &&
    NO_ACTIVATION_QUERY_STATUSES.has(order.esimStatus)
  ) {
    return false;
  }
  if (isActivationConfirmed(order)) return false;
  if (!hasAmbiguousInstallSignal(order)) return false;
  const checkedAt = asTime(order.activationCheckedAt);
  if (checkedAt === null) return true;
  return now.getTime() - checkedAt >= ACTIVATION_CHECK_INTERVAL_MS;
}

function resolveUsagePair(
  event: EsimSnapshotEvent,
): { total: bigint; used: bigint } | null {
  if (event.source === "validity_usage") return null;
  const total = finiteByte(event.totalVolume);
  const used = finiteByte(event.orderUsage);
  if (total !== null && used !== null) return { total, used };
  if (event.source !== "data_usage") return null;
  const remain = finiteByte(event.remain);
  if (total === null || remain === null) return null;
  const computed = total - remain;
  if (computed < 0n) return null;
  return { total, used: computed };
}

/**
 * Fold one provider observation onto the stored snapshot.
 * Omitted fields are left untouched. A missing usage number is not stored as zero.
 */
export function projectEsimSnapshot(
  current: EsimSnapshotState,
  event: EsimSnapshotEvent,
): EsimSnapshotPatch {
  const patch: EsimSnapshotPatch = {};

  if (event.esimStatus && isEsimLifecycleStatus(event.esimStatus)) {
    patch.esimStatus = event.esimStatus;
  }
  if (typeof event.smdpStatus === "string" && event.smdpStatus.length > 0) {
    patch.esimSmdpStatus = event.smdpStatus;
  }

  if (event.source === "query" && current.firstActivatedAt === null) {
    const activatedAt = parseProviderTime(event.activateTime);
    if (activatedAt) patch.firstActivatedAt = activatedAt;
  }

  const pair = resolveUsagePair(event);
  const regressesToZero =
    pair !== null &&
    current.dataUsedBytes !== null &&
    current.dataUsedBytes > 0n &&
    pair.used === 0n;
  const wroteUsage = pair !== null && !regressesToZero;
  if (wroteUsage && pair) {
    patch.dataTotalBytes = pair.total;
    patch.dataUsedBytes = pair.used;
  }

  let wroteExpiry = false;
  if (event.source === "validity_usage" || event.source === "query") {
    const expiresAt = parseProviderTime(event.expiredTime);
    if (expiresAt) {
      patch.expiresAt = expiresAt;
      wroteExpiry = true;
    }
  }

  if (wroteUsage || wroteExpiry) {
    patch.usageSyncedAt = event.observedAt;
  }

  return patch;
}

export function formatByteVolume(bytes: bigint): string {
  const value = Number(bytes);
  const gib = value / 1024 ** 3;
  if (gib >= 1) {
    return Number.isInteger(gib) ? `${gib} GB` : `${gib.toFixed(1)} GB`;
  }
  const mib = value / 1024 ** 2;
  return `${Math.round(mib)} MB`;
}

export function esimLifecycleView(order: LifecycleOrder): LifecycleView {
  const confirmed = isActivationConfirmed(order);
  const total = asBigInt(order.dataTotalBytes);
  const used = asBigInt(order.dataUsedBytes);
  const pair = total !== null && used !== null ? { total, used } : null;
  const dataExhausted = pair !== null && pair.used >= pair.total;

  if (
    order.esimStatus !== null &&
    KEEP_INSTALL_VISIBLE_STATUSES.has(order.esimStatus)
  ) {
    return { collapseInstall: false, focus: { kind: "install" } };
  }

  if (order.esimStatus === "CANCEL") {
    return { collapseInstall: true, focus: { kind: "cancelled" } };
  }

  if (order.esimStatus === "USED_UP") {
    return { collapseInstall: true, focus: { kind: "exhausted" } };
  }

  if (order.esimStatus === "USED_EXPIRED") {
    return {
      collapseInstall: true,
      focus: {
        kind: "expired",
        unused: false,
        expiresAt: order.expiresAt,
        dataExhausted,
      },
    };
  }

  if (order.esimStatus === "UNUSED_EXPIRED") {
    return {
      collapseInstall: confirmed,
      focus: {
        kind: "expired",
        unused: true,
        expiresAt: order.expiresAt,
        dataExhausted: false,
      },
    };
  }

  if (confirmed && pair) {
    const remaining = pair.total - pair.used;
    return {
      collapseInstall: true,
      focus: {
        kind: "remaining",
        remainingBytes: remaining < 0n ? 0n : remaining,
        usageSyncedAt: order.usageSyncedAt,
      },
    };
  }

  if (confirmed) {
    return {
      collapseInstall: true,
      focus: {
        kind: "usageUnavailable",
        usageSyncedAt: order.usageSyncedAt,
      },
    };
  }

  return { collapseInstall: false, focus: { kind: "install" } };
}
