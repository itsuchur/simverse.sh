import { describe, expect, test } from "bun:test";

import {
  esimStatusBadge,
  isEsimLifecycleStatus,
} from "~/lib/esim-status";

describe("isEsimLifecycleStatus", () => {
  test("recognizes lifecycle statuses", () => {
    expect(isEsimLifecycleStatus("NOT_ACTIVE")).toBe(true);
    expect(isEsimLifecycleStatus("IN_USE")).toBe(true);
    expect(isEsimLifecycleStatus("REVOKED")).toBe(true);
  });

  test("rejects transient supplier statuses", () => {
    expect(isEsimLifecycleStatus("GOT_RESOURCE")).toBe(false);
    expect(isEsimLifecycleStatus("in_use")).toBe(false);
    expect(isEsimLifecycleStatus("")).toBe(false);
  });
});

describe("esimStatusBadge", () => {
  test("SM-DP DELETED and DISABLED take precedence over lifecycle", () => {
    expect(esimStatusBadge("IN_USE", "DELETED")?.text).toBe("DELETED");
    expect(esimStatusBadge("IN_USE", "DISABLED")?.text).toBe("DISABLED");
  });

  test("lifecycle badge wins over other SM-DP statuses", () => {
    expect(esimStatusBadge("IN_USE", "ENABLED")?.text).toBe("IN USE");
    expect(esimStatusBadge("USED_UP", "ENABLED")?.text).toBe("USED_UP");
  });

  test("falls back to the SM-DP badge without a lifecycle status", () => {
    expect(esimStatusBadge(null, "ENABLED")?.text).toBe("ENABLED");
    expect(esimStatusBadge(null, "DOWNLOAD")?.text).toBe("DOWNLOAD");
  });

  test("missing or GOT_RESOURCE status means not activated yet", () => {
    expect(esimStatusBadge(null, null)?.text).toBe("NOT ACTIVATED");
    expect(esimStatusBadge("GOT_RESOURCE", null)?.text).toBe("NOT ACTIVATED");
  });

  test("unknown statuses pass through as a muted badge", () => {
    expect(esimStatusBadge("RELEASED", null)).toEqual({
      text: "RELEASED",
      className: "bg-muted",
    });
  });
});
