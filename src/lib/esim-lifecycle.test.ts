import { describe, expect, test } from "bun:test";

import {
  ACTIVATION_CHECK_INTERVAL_MS,
  esimLifecycleView,
  isActivationConfirmed,
  needsActivationFallback,
  parseProviderTime,
  projectEsimSnapshot,
  type ActivationFallbackOrder,
  type EsimSnapshotState,
  type LifecycleOrder,
} from "~/lib/esim-lifecycle";

const GIB = 1024n ** 3n;
const observedAt = new Date("2026-04-11T12:00:00Z");

function lifecycle(over: Partial<LifecycleOrder> = {}): LifecycleOrder {
  return {
    esimStatus: null,
    esimSmdpStatus: null,
    firstActivatedAt: null,
    dataTotalBytes: null,
    dataUsedBytes: null,
    expiresAt: null,
    usageSyncedAt: null,
    ...over,
  };
}

function snapshot(over: Partial<EsimSnapshotState> = {}): EsimSnapshotState {
  return {
    esimStatus: null,
    esimSmdpStatus: null,
    firstActivatedAt: null,
    dataTotalBytes: null,
    dataUsedBytes: null,
    expiresAt: null,
    usageSyncedAt: null,
    ...over,
  };
}

function fallback(
  over: Partial<ActivationFallbackOrder> = {},
): ActivationFallbackOrder {
  return {
    esimStatus: "IN_USE",
    esimSmdpStatus: "ENABLED",
    firstActivatedAt: null,
    dataUsedBytes: null,
    resellerOrderId: "EA-1",
    webhookHistoryAppliedAt: observedAt,
    activationCheckedAt: null,
    ...over,
  };
}

describe("esimLifecycleView", () => {
  test("keeps installation visible when activation is unknown", () => {
    expect(esimLifecycleView(lifecycle()).focus.kind).toBe("install");
    expect(esimLifecycleView(lifecycle()).collapseInstall).toBe(false);
    expect(
      esimLifecycleView(
        lifecycle({ esimStatus: "IN_USE", esimSmdpStatus: "ENABLED" }),
      ),
    ).toMatchObject({ collapseInstall: false, focus: { kind: "install" } });
  });

  test("does not treat a stored zero usage reading as remaining data", () => {
    const view = esimLifecycleView(
      lifecycle({
        esimStatus: "IN_USE",
        dataTotalBytes: GIB.toString(),
        dataUsedBytes: "0",
      }),
    );
    expect(view).toMatchObject({
      collapseInstall: false,
      focus: { kind: "install" },
    });
  });

  test("shows remaining data after a positive usage reading", () => {
    const view = esimLifecycleView(
      lifecycle({
        esimStatus: "IN_USE",
        dataTotalBytes: (2n * GIB).toString(),
        dataUsedBytes: GIB.toString(),
        usageSyncedAt: observedAt.toISOString(),
      }),
    );
    expect(view.collapseInstall).toBe(true);
    expect(view.focus).toEqual({
      kind: "remaining",
      remainingBytes: GIB,
      usageSyncedAt: observedAt.toISOString(),
    });
    expect(isActivationConfirmed(lifecycle({ dataUsedBytes: GIB.toString() }))).toBe(
      true,
    );
  });

  test("shows the full allowance when activation time is known and usage is zero", () => {
    const view = esimLifecycleView(
      lifecycle({
        firstActivatedAt: observedAt.toISOString(),
        dataTotalBytes: GIB.toString(),
        dataUsedBytes: "0",
        usageSyncedAt: observedAt.toISOString(),
      }),
    );
    expect(view.focus).toMatchObject({
      kind: "remaining",
      remainingBytes: GIB,
    });
  });

  test("says usage is unavailable when activation is confirmed without a byte pair", () => {
    const view = esimLifecycleView(
      lifecycle({ firstActivatedAt: observedAt.toISOString() }),
    );
    expect(view).toMatchObject({
      collapseInstall: true,
      focus: { kind: "usageUnavailable", usageSyncedAt: null },
    });
  });

  test("distinguishes exhausted data from expiry", () => {
    expect(esimLifecycleView(lifecycle({ esimStatus: "USED_UP" }))).toEqual({
      collapseInstall: true,
      focus: { kind: "exhausted" },
    });
    expect(
      esimLifecycleView(
        lifecycle({
          esimStatus: "USED_EXPIRED",
          expiresAt: observedAt.toISOString(),
          dataTotalBytes: GIB.toString(),
          dataUsedBytes: GIB.toString(),
        }),
      ).focus,
    ).toEqual({
      kind: "expired",
      unused: false,
      expiresAt: observedAt.toISOString(),
      dataExhausted: true,
    });
    expect(
      esimLifecycleView(lifecycle({ esimStatus: "USED_EXPIRED" })).focus,
    ).toMatchObject({
      kind: "expired",
      unused: false,
      expiresAt: null,
      dataExhausted: false,
    });
  });

  test("keeps installation visible for an unused expiry", () => {
    const view = esimLifecycleView(
      lifecycle({
        esimStatus: "UNUSED_EXPIRED",
        expiresAt: observedAt.toISOString(),
      }),
    );
    expect(view.collapseInstall).toBe(false);
    expect(view.focus).toMatchObject({ kind: "expired", unused: true });
  });

  test("keeps installation visible for cancel, revoke, and suspend", () => {
    for (const esimStatus of ["CANCEL", "REVOKED", "SUSPENDED"]) {
      expect(
        esimLifecycleView(
          lifecycle({
            esimStatus,
            firstActivatedAt: observedAt.toISOString(),
          }),
        ),
      ).toMatchObject({ collapseInstall: false, focus: { kind: "install" } });
    }
  });
});

describe("projectEsimSnapshot", () => {
  test("stores a DATA_USAGE pair and ignores a missing usage field", () => {
    const stored = projectEsimSnapshot(snapshot(), {
      source: "data_usage",
      observedAt,
      totalVolume: Number(GIB),
      orderUsage: Number(GIB / 2n),
    });
    expect(stored.dataTotalBytes).toBe(GIB);
    expect(stored.dataUsedBytes).toBe(GIB / 2n);
    expect(stored.usageSyncedAt).toBe(observedAt);

    const missing = projectEsimSnapshot(snapshot(), {
      source: "data_usage",
      observedAt,
      remain: 10,
    });
    expect(missing.dataUsedBytes).toBeUndefined();
    expect(missing.dataTotalBytes).toBeUndefined();
    expect(missing.usageSyncedAt).toBeUndefined();
  });

  test("completes a DATA_USAGE pair from total and remain bytes", () => {
    const stored = projectEsimSnapshot(snapshot(), {
      source: "data_usage",
      observedAt,
      totalVolume: 1000,
      remain: 250,
    });
    expect(stored.dataUsedBytes).toBe(750n);
    expect(stored.dataTotalBytes).toBe(1000n);
  });

  test("stores a real zero and does not replace positive usage with zero", () => {
    const zero = projectEsimSnapshot(snapshot(), {
      source: "query",
      observedAt,
      totalVolume: 1000,
      orderUsage: 0,
    });
    expect(zero.dataUsedBytes).toBe(0n);

    const kept = projectEsimSnapshot(
      snapshot({ dataTotalBytes: 1000n, dataUsedBytes: 400n }),
      {
        source: "data_usage",
        observedAt,
        totalVolume: 2000,
        orderUsage: 0,
      },
    );
    expect(kept.dataUsedBytes).toBeUndefined();
    expect(kept.dataTotalBytes).toBeUndefined();
  });

  test("allows a larger total volume", () => {
    const stored = projectEsimSnapshot(
      snapshot({ dataTotalBytes: 1000n, dataUsedBytes: 100n }),
      {
        source: "query",
        observedAt,
        totalVolume: 5000,
        orderUsage: 100,
      },
    );
    expect(stored.dataTotalBytes).toBe(5000n);
    expect(stored.dataUsedBytes).toBe(100n);
  });

  test("stores validity expiry and never treats remain as bytes", () => {
    const stored = projectEsimSnapshot(snapshot(), {
      source: "validity_usage",
      observedAt,
      expiredTime: "2026-05-01T00:00:00Z",
      remain: 1,
      totalVolume: 1000,
      orderUsage: 10,
    });
    expect(stored.expiresAt?.toISOString()).toBe("2026-05-01T00:00:00.000Z");
    expect(stored.usageSyncedAt).toBe(observedAt);
    expect(stored.dataUsedBytes).toBeUndefined();
    expect(stored.dataTotalBytes).toBeUndefined();
    expect(stored.firstActivatedAt).toBeUndefined();
  });

  test("does not set first activation from an installation event", () => {
    const stored = projectEsimSnapshot(snapshot(), {
      source: "status",
      observedAt,
      esimStatus: "IN_USE",
      smdpStatus: "ENABLED",
      activateTime: "2026-04-11T12:00:00Z",
    });
    expect(stored.esimStatus).toBe("IN_USE");
    expect(stored.esimSmdpStatus).toBe("ENABLED");
    expect(stored.firstActivatedAt).toBeUndefined();
    expect(stored.usageSyncedAt).toBeUndefined();
  });

  test("sets first activation once from a query and keeps it when a later query omits it", () => {
    const activated = parseProviderTime("2026-04-10T21:13:01+0000");
    if (activated === null) {
      throw new Error("activateTime did not parse");
    }
    const first = projectEsimSnapshot(snapshot(), {
      source: "query",
      observedAt,
      activateTime: "2026-04-10T21:13:01+0000",
    });
    expect(first.firstActivatedAt).toEqual(activated);

    const second = projectEsimSnapshot(
      snapshot({ firstActivatedAt: activated }),
      {
        source: "query",
        observedAt,
        activateTime: null,
        esimStatus: "IN_USE",
      },
    );
    expect(second.firstActivatedAt).toBeUndefined();
    expect(second.esimStatus).toBe("IN_USE");
  });

  test("does not clear a previous status when the event omits it", () => {
    const stored = projectEsimSnapshot(snapshot({ esimStatus: "IN_USE" }), {
      source: "data_usage",
      observedAt,
      totalVolume: 100,
      orderUsage: 20,
    });
    expect(stored.esimStatus).toBeUndefined();
  });
});

describe("needsActivationFallback", () => {
  test("waits until webhook history has been applied", () => {
    expect(
      needsActivationFallback(
        fallback({ webhookHistoryAppliedAt: null }),
        observedAt,
      ),
    ).toBe(false);
  });

  test("requires an ambiguous install signal and a provider order id", () => {
    expect(
      needsActivationFallback(
        fallback({ esimStatus: null, esimSmdpStatus: "RELEASED" }),
        observedAt,
      ),
    ).toBe(false);
    expect(
      needsActivationFallback(fallback({ resellerOrderId: null }), observedAt),
    ).toBe(false);
  });

  test("does not query when a webhook already confirmed activation", () => {
    expect(
      needsActivationFallback(fallback({ dataUsedBytes: 10n }), observedAt),
    ).toBe(false);
    expect(
      needsActivationFallback(fallback({ esimStatus: "USED_UP" }), observedAt),
    ).toBe(false);
  });

  test("does not query terminal or suspended profiles", () => {
    for (const esimStatus of [
      "UNUSED_EXPIRED",
      "CANCEL",
      "REVOKED",
      "SUSPENDED",
    ]) {
      expect(
        needsActivationFallback(fallback({ esimStatus }), observedAt),
      ).toBe(false);
    }
  });

  test("throttles a repeated check for 30 minutes", () => {
    expect(needsActivationFallback(fallback(), observedAt)).toBe(true);
    expect(
      needsActivationFallback(
        fallback({ activationCheckedAt: observedAt }),
        new Date(observedAt.getTime() + ACTIVATION_CHECK_INTERVAL_MS - 1),
      ),
    ).toBe(false);
    expect(
      needsActivationFallback(
        fallback({ activationCheckedAt: observedAt }),
        new Date(observedAt.getTime() + ACTIVATION_CHECK_INTERVAL_MS),
      ),
    ).toBe(true);
  });
});
