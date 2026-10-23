"use client";

import { ReasonActionButton } from "../_components/reason-action-button";
import { refundOrder } from "./actions";

export function RefundOrderButton({
  orderUuid,
  refundReason,
}: {
  orderUuid: string;
  refundReason: string | null;
}) {
  return (
    <ReasonActionButton
      label="Refund"
      initialReason={refundReason ?? ""}
      onSubmit={(reason) => refundOrder(orderUuid, reason)}
    />
  );
}
