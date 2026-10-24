import { hasPastPickup, type CairoNowParts } from "../time/cairoTime.ts";

export const WAITING_LIST_PASSENGER_SELECT = "name phone email";

export type WaitingListAction = "approve" | "reject" | "offer_private";

export type WaitingListActionInput = {
  action: WaitingListAction;
  tripId?: string;
  reason?: string;
};

export type { CairoNowParts } from "../time/cairoTime.ts";

export function getSharedRideWaitingListEnabled(
  value: boolean | null | undefined,
): boolean {
  return value ?? true;
}

export function shouldCreateWaitingListRequest(
  hasSharedRide: boolean,
  enabled: boolean,
): boolean {
  return hasSharedRide && enabled;
}

export function hasPastTrip(
  trips: readonly { date: string; pickupTime: string }[],
  now: CairoNowParts,
): boolean {
  return hasPastPickup(trips, now);
}

export const hasPastWaitingListTrip = hasPastTrip;

export function countWaitingListRows(
  requestCount: number,
  tripCount: number,
): number {
  return requestCount + tripCount;
}

export function paginateWaitingListRows<
  T extends {
    kind: "request" | "trip";
    record: { _id: unknown; createdAt: Date | string };
  },
>(rows: T[], page: number, limit: number): T[] {
  return rows
    .sort((left, right) => {
      const createdAtDifference =
        new Date(left.record.createdAt).getTime() -
        new Date(right.record.createdAt).getTime();
      return (
        createdAtDifference ||
        String(left.record._id).localeCompare(String(right.record._id))
      );
    })
    .slice((page - 1) * limit, page * limit);
}

export function validateWaitingListAction(
  body: unknown,
): { ok: true; value: WaitingListActionInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body." };
  }

  const input = body as Record<string, unknown>;
  if (
    input.action !== "approve" &&
    input.action !== "reject" &&
    input.action !== "offer_private"
  ) {
    return {
      ok: false,
      error: "action must be approve, reject, or offer_private.",
    };
  }

  if (input.action === "offer_private") {
    if (typeof input.tripId !== "string" || !input.tripId.trim()) {
      return { ok: false, error: "tripId is required for a private-ride offer." };
    }
    if (input.reason !== undefined) {
      return { ok: false, error: "reason is not accepted for a private-ride offer." };
    }
    return {
      ok: true,
      value: { action: "offer_private", tripId: input.tripId.trim() },
    };
  }

  if (input.tripId !== undefined) {
    return { ok: false, error: "tripId is only accepted for a private-ride offer." };
  }

  if (input.action === "approve" && input.reason !== undefined) {
    return { ok: false, error: "reason is only accepted when rejecting." };
  }

  if (
    input.action === "reject" &&
    input.reason !== undefined &&
    typeof input.reason !== "string"
  ) {
    return { ok: false, error: "reason must be a string." };
  }

  const reason =
    typeof input.reason === "string" ? input.reason.trim() : undefined;
  if (input.action === "reject" && !reason) {
    return { ok: false, error: "reason is required when rejecting." };
  }
  if (reason && reason.length > 500) {
    return { ok: false, error: "reason must be 500 characters or fewer." };
  }

  return {
    ok: true,
    value: {
      action: input.action,
      ...(reason ? { reason } : {}),
    },
  };
}

export function buildWaitingListTransitionFilter(requestId: unknown) {
  return { _id: requestId, status: "waiting_list" };
}

export function buildWaitingListTripTransitionFilter(tripId: unknown) {
  return { _id: tripId, requestId: null, status: "waiting_list" };
}

export function buildWaitingListReviewUpdate(
  action: WaitingListAction,
  adminId: unknown,
  reviewedAt: Date,
  reason?: string,
) {
  return {
    $set: {
      status: action === "approve" ? "approved" : "rejected",
      reviewedBy: adminId,
      reviewedAt,
      ...(action === "reject" && reason ? { rejectionReason: reason } : {}),
    },
    ...(action === "reject" && !reason
      ? { $unset: { rejectionReason: 1 } }
      : {}),
  };
}

export function buildWaitingListTripCancellationUpdate(
  cancelledAt: Date,
  reason: string,
) {
  return {
    $set: {
      status: "cancelled",
      cancelledBy: "admin_rejected",
      cancelReason: reason,
      cancellation: {
        cancelledAt,
        tierLabel: "admin_rejected",
        refundPercent: 0,
        penaltyPercent: 0,
        refundAmount: 0,
        retainedAmount: 0,
        refundStatus: "none",
        reason,
      },
    },
  };
}

export function groupPromoUsageCounts(
  usages: readonly { promoCode: unknown }[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const usage of usages) {
    const promoId = String(usage.promoCode);
    counts.set(promoId, (counts.get(promoId) ?? 0) + 1);
  }
  return counts;
}

type WaitingListNotification = {
  userId: string;
  type:
    | "waiting_list_created"
    | "waiting_list_approved"
    | "waiting_list_rejected";
  title: string;
  body: string;
  titleAr: string;
  bodyAr: string;
  data: Record<string, unknown>;
};

export type WaitingListPassengerRecord = {
  name?: string;
  phone?: string;
  email?: string;
};

export type WaitingListTripRecord = {
  _id: unknown;
  requestId?: unknown;
  userId?: WaitingListPassengerRecord | null;
  appliedPromoCode?: unknown;
  pickup?: { address?: string } | null;
  dropoff?: { address?: string } | null;
  date: string;
  pickupTime: string;
  arrivalTime: string;
  vehicleType: string;
  status?: string;
  preferedGender?: string | null;
  numberOfPassengers: number;
  priceEgp: number;
  note?: string;
};

export type WaitingListRequestRecord = {
  _id: unknown;
  createdAt: Date | string;
  amountEgp: number;
  note?: string;
};

export function buildWaitingListCreatedAdminNotifications(input: {
  adminIds: readonly string[];
  bookingId: string;
  routeSummary: string;
  date: string;
}): WaitingListNotification[] {
  return input.adminIds.map((adminId) => ({
    userId: adminId,
    type: "waiting_list_created",
    title: "New shared-ride request",
    body: `${input.routeSummary} on ${input.date} is waiting for review.`,
    titleAr: "طلب رحلة مشتركة جديد",
    bodyAr: `طلب رحلة مشتركة من ${input.routeSummary} يوم ${input.date} مستني المراجعة.`,
    data: {
      bookingId: input.bookingId,
      linkUrl: "/admin/waiting-list",
      linkLabel: "Review waiting list",
    },
  }));
}

export function buildWaitingListCreatedTripAdminNotifications(input: {
  adminIds: readonly string[];
  tripId: string;
  routeSummary: string;
  date: string;
}): WaitingListNotification[] {
  return input.adminIds.map((adminId) => ({
    userId: adminId,
    type: "waiting_list_created",
    title: "New shared-ride trip",
    body: `${input.routeSummary} on ${input.date} is waiting for review.`,
    titleAr: "رحلة مشتركة جديدة",
    bodyAr: `رحلة مشتركة من ${input.routeSummary} يوم ${input.date} مستنية المراجعة.`,
    data: {
      bookingId: input.tripId,
      tripId: input.tripId,
      linkUrl: "/admin/waiting-list",
      linkLabel: "Review waiting list",
    },
  }));
}

export function buildWaitingListCreatedTripBatchAdminNotifications(input: {
  adminIds: readonly string[];
  tripId: string;
  batchId: string;
  tripCount: number;
  routeSummary: string;
  date: string;
}): WaitingListNotification[] {
  return input.adminIds.map((adminId) => ({
    userId: adminId,
    type: "waiting_list_created",
    title: `${input.tripCount} new shared-ride trips`,
    body: `${input.routeSummary} on ${input.date}: ${input.tripCount} trips are waiting for review.`,
    titleAr: `${input.tripCount} رحلات مشتركة جديدة`,
    bodyAr: `${input.tripCount} رحلات مشتركة من ${input.routeSummary} يوم ${input.date} مستنية المراجعة.`,
    data: {
      batchId: input.batchId,
      bookingId: input.tripId,
      tripId: input.tripId,
      tripCount: input.tripCount,
      linkUrl: "/admin/waiting-list",
      linkLabel: "Review waiting list",
    },
  }));
}

export function waitingListTripBatchDedupeKey(batchId: string): string {
  return `batch:${batchId}:waiting_list_created`;
}

export function buildWaitingListApprovedNotification(
  userId: string,
  bookingId: string,
  tripId: string,
): WaitingListNotification {
  return {
    userId,
    type: "waiting_list_approved",
    title: "Your shared-ride request was approved",
    body: "Your request was approved. You can now continue to payment.",
    titleAr: "تمت الموافقة على طلب الرحلة المشتركة",
    bodyAr: "تمت الموافقة على طلبك. تقدر دلوقتي تكمل الدفع.",
    data: {
      bookingId,
      tripId,
      linkUrl: `/my-trips/${tripId}`,
      linkLabel: "Continue to payment",
    },
  };
}

export function buildWaitingListRejectedNotification(
  userId: string,
  bookingId: string,
  tripId: string,
  reason?: string,
): WaitingListNotification {
  const normalizedReason = reason?.trim();
  const reasonSuffix = normalizedReason ? ` Reason: ${normalizedReason}` : "";
  const reasonSuffixAr = normalizedReason ? ` السبب: ${normalizedReason}` : "";
  return {
    userId,
    type: "waiting_list_rejected",
    title: "Your shared-ride request was rejected",
    body: `Your request was rejected.${reasonSuffix}`,
    titleAr: "لم تتم الموافقة على طلب الرحلة المشتركة",
    bodyAr: `الطلب لم تتم الموافقة عليه.${reasonSuffixAr}`,
    data: {
      bookingId,
      tripId,
      linkUrl: `/my-trips/${tripId}`,
      linkLabel: "View request",
    },
  };
}

export function mapWaitingListRequest(input: {
  request: WaitingListRequestRecord;
  passenger: WaitingListPassengerRecord | null;
  trips: WaitingListTripRecord[];
  promoCodes: string[];
  hasPastTrip: boolean;
}) {
  return {
    kind: "request" as const,
    id: String(input.request._id),
    createdAt: input.request.createdAt,
    totalFare: input.request.amountEgp,
    hasPastTrip: input.hasPastTrip,
    promoCodes: input.promoCodes,
    note: input.request.note ?? "",
    passenger: input.passenger
      ? {
          name: input.passenger.name,
          phone: input.passenger.phone,
          email: input.passenger.email,
        }
      : null,
    trips: input.trips.map((trip) => ({
      id: String(trip._id),
      route: {
        pickup: trip.pickup,
        dropoff: trip.dropoff,
      },
      date: trip.date,
      pickupTime: trip.pickupTime,
      arrivalTime: trip.arrivalTime,
      vehicleType: trip.vehicleType,
      status: trip.status ?? "pending_payment",
      numberOfPassengers: trip.numberOfPassengers,
      preferedGender: trip.preferedGender ?? null,
      fare: trip.priceEgp,
    })),
  };
}

export function mapWaitingListTrip(input: {
  trip: WaitingListTripRecord & { createdAt: Date | string };
  passenger: WaitingListPassengerRecord | null;
  promoCodes: string[];
  hasPastTrip: boolean;
}) {
  return {
    kind: "trip" as const,
    id: String(input.trip._id),
    createdAt: input.trip.createdAt,
    totalFare: input.trip.priceEgp,
    hasPastTrip: input.hasPastTrip,
    promoCodes: input.promoCodes,
    note: input.trip.note ?? "",
    passenger: input.passenger
      ? {
          name: input.passenger.name,
          phone: input.passenger.phone,
          email: input.passenger.email,
        }
      : null,
    trips: [
      {
        id: String(input.trip._id),
        route: {
          pickup: input.trip.pickup,
          dropoff: input.trip.dropoff,
        },
        date: input.trip.date,
        pickupTime: input.trip.pickupTime,
        arrivalTime: input.trip.arrivalTime,
        vehicleType: input.trip.vehicleType,
        status: input.trip.status ?? "waiting_list",
        numberOfPassengers: input.trip.numberOfPassengers,
        fare: input.trip.priceEgp,
      },
    ],
  };
}
