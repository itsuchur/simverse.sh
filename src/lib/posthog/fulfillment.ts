export type EsimFulfillmentRecord = {
  outcome: "issued" | "failed";
  kind: "issue" | "topup";
  distinctId: string | null | undefined;
  orderUuid: string;
  packageCode: string;
  failureReason?: string;
};

/** Event payload for the last step of eSIM fulfillment. */
export function esimFulfillmentCapture(input: EsimFulfillmentRecord): {
  event: string;
  distinctId: string | null | undefined;
  orderUuid: string;
  properties: Record<string, string | number | boolean | null | undefined>;
} {
  const event =
    input.outcome === "failed"
      ? "esim_issue_failed"
      : input.kind === "topup"
        ? "esim_topup_issued"
        : "esim_issued";

  return {
    event,
    distinctId: input.distinctId,
    orderUuid: input.orderUuid,
    properties: {
      kind: input.kind,
      packageCode: input.packageCode,
      ...(input.outcome === "failed"
        ? { failureReason: input.failureReason ?? null }
        : {}),
    },
  };
}
