export const ESIM_LIFECYCLE_STATUSES = new Set([
  "NOT_ACTIVE",
  "IN_USE",
  "USED_EXPIRED",
  "UNUSED_EXPIRED",
  "USED_UP",
  "CANCEL",
  "REVOKED",
  "SUSPENDED",
]);

/** Terminal supplier statuses that should beat a device-level DISABLED flag. */
const TERMINAL_LIFECYCLE_STATUSES = new Set([
  "USED_EXPIRED",
  "UNUSED_EXPIRED",
  "USED_UP",
  "CANCEL",
  "REVOKED",
]);

export function isEsimLifecycleStatus(value: string): boolean {
  return ESIM_LIFECYCLE_STATUSES.has(value);
}

export const ESIM_STATUS_LABEL = {
  notActivated: "notActivated",
  inUse: "inUse",
  expired: "expired",
  usedUp: "usedUp",
  cancelled: "cancelled",
  revoked: "revoked",
  deleted: "deleted",
  disabled: "disabled",
  enabled: "enabled",
  installation: "installation",
  download: "download",
} as const;

export type EsimStatusLabel =
  (typeof ESIM_STATUS_LABEL)[keyof typeof ESIM_STATUS_LABEL];

type StatusBadge = {
  /** Message key under `EsimStatus`. Null keeps `text` as the raw code. */
  label: EsimStatusLabel | null;
  text: string;
  className: string;
};

const AMBER = "bg-amber-200";
const GREEN = "bg-green-200";
const RED = "bg-red-200";
const DARK_RED = "bg-red-800 text-white";

function badge(
  label: EsimStatusLabel,
  text: string,
  className: string,
): StatusBadge {
  return { label, text, className };
}

const LIFECYCLE_BADGES: Record<string, StatusBadge> = {
  NOT_ACTIVE: badge(ESIM_STATUS_LABEL.notActivated, "NOT ACTIVATED", AMBER),
  IN_USE: badge(ESIM_STATUS_LABEL.inUse, "IN USE", GREEN),
  USED_EXPIRED: badge(ESIM_STATUS_LABEL.expired, "EXPIRED", DARK_RED),
  UNUSED_EXPIRED: badge(ESIM_STATUS_LABEL.expired, "EXPIRED", DARK_RED),
  USED_UP: badge(ESIM_STATUS_LABEL.usedUp, "USED_UP", DARK_RED),
  CANCEL: badge(ESIM_STATUS_LABEL.cancelled, "CANCELLED", DARK_RED),
  REVOKED: badge(ESIM_STATUS_LABEL.revoked, "REVOKED", DARK_RED),
};

const SMDP_BADGES: Record<string, StatusBadge> = {
  DELETED: badge(ESIM_STATUS_LABEL.deleted, "DELETED", RED),
  DISABLED: badge(ESIM_STATUS_LABEL.disabled, "DISABLED", AMBER),
  ENABLED: badge(ESIM_STATUS_LABEL.enabled, "ENABLED", GREEN),
  INSTALLATION: badge(ESIM_STATUS_LABEL.installation, "INSTALLATION", AMBER),
  DOWNLOAD: badge(ESIM_STATUS_LABEL.download, "DOWNLOAD", AMBER),
};

export function esimStatusBadge(
  esimStatus: string | null,
  smdpStatus: string | null,
): StatusBadge | null {
  if (esimStatus && TERMINAL_LIFECYCLE_STATUSES.has(esimStatus)) {
    return (
      LIFECYCLE_BADGES[esimStatus] ?? {
        label: null,
        text: esimStatus,
        className: DARK_RED,
      }
    );
  }
  if (smdpStatus === "DELETED" || smdpStatus === "DISABLED") {
    return SMDP_BADGES[smdpStatus] ?? null;
  }
  if (esimStatus && LIFECYCLE_BADGES[esimStatus]) {
    return LIFECYCLE_BADGES[esimStatus];
  }
  if (smdpStatus && SMDP_BADGES[smdpStatus]) {
    return SMDP_BADGES[smdpStatus];
  }
  if (!esimStatus || esimStatus === "GOT_RESOURCE") {
    return LIFECYCLE_BADGES.NOT_ACTIVE ?? null;
  }
  return { label: null, text: esimStatus, className: "bg-muted" };
}
