import { hasEsimCredentials } from "~/lib/esim-provisioning";
import { orderStatus, paymentStatus } from "~/lib/order-status";

export function needsDeliveryRefresh(
  order: Parameters<typeof hasEsimCredentials>[0] & {
    paymentStatus: string;
    status?: string;
  },
) {
  if (order.status === orderStatus.refundRequired) return false;
  return (
    order.paymentStatus === paymentStatus.pending ||
    (order.paymentStatus === paymentStatus.paid && !hasEsimCredentials(order))
  );
}
