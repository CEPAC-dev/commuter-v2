import { getDisplayStatus } from "./statusDisplay.ts";

export type SharedRideStep = 0 | 1 | 2 | 3;

export function getSharedRideStep({
  request,
  trip,
}: {
  request?: {
    status?: string | null;
    paymentStatus?: string | null;
    rejectionReason?: string | null;
    hasPastTrip?: boolean;
  } | null;
  trip?: {
    status?: string | null;
    paymentStatus?: string | null;
    date?: string | null;
    pickupTime?: string | null;
    cancelledBy?: string | null;
    cancelReason?: string | null;
  } | null;
}): { step: SharedRideStep | null; rejected: boolean } {
  const key = getDisplayStatus({ request, trip }).key;

  if (key === "request_status.rejected") return { step: 1, rejected: true };
  if (key === "status.waiting_list") return { step: 1, rejected: false };
  if (key === "status.pending_payment") return { step: 2, rejected: false };
  if (key === "payments.paid" || key === "status.searching_for_ride") {
    return { step: 2, rejected: false };
  }
  if (["status.matched", "status.confirmed", "status.in_progress"].includes(key)) {
    return { step: 3, rejected: false };
  }
  return { step: null, rejected: false };
}
