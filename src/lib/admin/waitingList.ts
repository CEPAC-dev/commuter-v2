export const WAITING_LIST_PASSENGER_SELECT = "name phone email";

export type WaitingListAction = "approve" | "reject";

export type WaitingListActionInput = {
  action: WaitingListAction;
  reason?: string;
};

export type CairoNowParts = { dateStr: string; timeStr: string };

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
  return trips.some(
    (trip) =>
      trip.date < now.dateStr ||
      (trip.date === now.dateStr && trip.pickupTime < now.timeStr),
  );
}

export const hasPastWaitingListTrip = hasPastTrip;

export function validateWaitingListAction(
  body: unknown,
): { ok: true; value: WaitingListActionInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body." };
  }

  const input = body as Record<string, unknown>;
  if (input.action !== "approve" && input.action !== "reject") {
    return { ok: false, error: "action must be approve or reject." };
  }

  if (input.action === "approve" && input.reason !== undefined) {
    return { ok: false, error: "reason is only accepted when rejecting." };
  }

  if (input.action === "reject" && input.reason !== undefined && typeof input.reason !== "string") {
    return { ok: false, error: "reason must be a string." };
  }

  const reason = typeof input.reason === "string" ? input.reason.trim() : undefined;
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
    ...(action === "reject" && !reason ? { $unset: { rejectionReason: 1 } } : {}),
  };
}

export function buildWaitingListTripCancellationUpdate(
  cancelledAt: Date,
  reason: string,
) {
  return {
    $set: {
      status: "cancelled",
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
  type: "waiting_list_created" | "waiting_list_approved" | "waiting_list_rejected";
  title: string;
  body: string;
  titleAr: string;
  bodyAr: string;
  data: Record<string, unknown>;
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

export function buildWaitingListApprovedNotification(
  userId: string,
  bookingId: string,
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
      linkUrl: `/my-requests/${bookingId}`,
      linkLabel: "Continue to payment",
    },
  };
}

export function buildWaitingListRejectedNotification(
  userId: string,
  bookingId: string,
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
      linkUrl: `/my-requests/${bookingId}`,
      linkLabel: "View request",
    },
  };
}

export function mapWaitingListRequest(input: {
  request: Record<string, any>;
  passenger: Record<string, any> | null;
  trips: Record<string, any>[];
  promoCodes: string[];
  hasPastTrip: boolean;
}) {
  return {
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
      numberOfPassengers: trip.numberOfPassengers,
      fare: trip.priceEgp,
    })),
  };
}
