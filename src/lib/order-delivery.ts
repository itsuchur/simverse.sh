import { hasEsimCredentials } from "~/lib/esim-provisioning";
import { paymentStatus } from "~/lib/order-status";

export function needsDeliveryRefresh(
  order: Parameters<typeof hasEsimCredentials>[0] & { paymentStatus: string },
) {
  return (
    order.paymentStatus === paymentStatus.pending ||
    (order.paymentStatus === paymentStatus.paid && !hasEsimCredentials(order))
  );
}
