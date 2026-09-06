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

type StatusBadge = { text: string; className: string };

const AMBER = "bg-amber-200";
const GREEN = "bg-green-200";
const RED = "bg-red-200";
const DARK_RED = "bg-red-800 text-white";

const LIFECYCLE_BADGES: Record<string, StatusBadge> = {
  NOT_ACTIVE: { text: "NOT ACTIVATED", className: AMBER },
  IN_USE: { text: "IN USE", className: GREEN },
  USED_EXPIRED: { text: "EXPIRED", className: DARK_RED },
  UNUSED_EXPIRED: { text: "EXPIRED", className: DARK_RED },
  USED_UP: { text: "USED_UP", className: DARK_RED },
  CANCEL: { text: "CANCELLED", className: DARK_RED },
  REVOKED: { text: "REVOKED", className: DARK_RED },
};

const SMDP_BADGES: Record<string, StatusBadge> = {
  DELETED: { text: "DELETED", className: RED },
  DISABLED: { text: "DISABLED", className: AMBER },
  ENABLED: { text: "ENABLED", className: GREEN },
  INSTALLATION: { text: "INSTALLATION", className: AMBER },
  DOWNLOAD: { text: "DOWNLOAD", className: AMBER },
};

export function esimStatusBadge(
  esimStatus: string | null,
  smdpStatus: string | null,
): StatusBadge | null {
  if (esimStatus && TERMINAL_LIFECYCLE_STATUSES.has(esimStatus)) {
    return (
      LIFECYCLE_BADGES[esimStatus] ?? {
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
  return { text: esimStatus, className: "bg-muted" };
}
