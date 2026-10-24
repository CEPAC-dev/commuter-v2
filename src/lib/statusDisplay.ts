import { getRequestPaymentState } from "./requestPaymentState.ts";
import { getCairoNowParts, hasPastPickup } from "./time/cairoTime.ts";
import { getStandaloneTripCancellationMode } from "./standaloneTripCancellation.ts";
import {
  isApprovedTripPickupPast,
  isStandaloneTripPayable,
} from "./payments/resolvePayableBookingRecord.ts";

type TripLike = {
  id?: string;
  isStandalone?: boolean;
  status?: string | null;
  paymentStatus?: string | null;
  date?: string | null;
  pickupTime?: string | null;
  rejectionReason?: string | null;
  cancelledBy?: string | null;
  cancelReason?: string | null;
  cancellation?: {
    refundStatus?: string | null;
    reason?: string | null;
  } | null;
};

type RequestLike = {
  status?: string | null;
  paymentStatus?: string | null;
  rejectionReason?: string | null;
  hasPastTrip?: boolean;
  trips?: readonly TripLike[];
};

type DisplayTone = "neutral" | "warning" | "success" | "danger" | "info";

export type DisplayStatus = {
  key: string;
  tone: DisplayTone;
  secondaryKey?: string;
  secondaryText?: string;
  canPay: boolean;
  canCancel: boolean;
  canRate: boolean;
  showRefundBadge: boolean;
};

function hasPastTrip(request: RequestLike, trip: TripLike | undefined, now: Date): boolean {
  if (request.hasPastTrip === true) return true;
  const trips = request.trips;
  if (trips?.length) return hasPastPickup(trips, now);
  return trip ? hasPastPickup([trip], now) : false;
}

function result(
  key: string,
  tone: DisplayTone,
  options: Partial<DisplayStatus> = {},
): DisplayStatus {
  return {
    key,
    tone,
    canPay: false,
    canCancel: false,
    canRate: false,
    showRefundBadge: false,
    ...options,
  };
}

export function getDisplayStatus({
  request,
  trip,
  now = new Date(),
}: {
  request?: RequestLike | null;
  trip?: TripLike | null;
  now?: Date;
}): DisplayStatus {
  const parent = request ?? {};
  const child = trip ?? undefined;
  if (child?.isStandalone) {
    const status = child.status ?? "";
    const paymentStatus = child.paymentStatus ?? "pending";
    const payable =
      isStandaloneTripPayable({ status, paymentStatus }) &&
      !(
        status === "approved" &&
        child.date &&
        child.pickupTime &&
        isApprovedTripPickupPast(
          { status, date: child.date, pickupTime: child.pickupTime },
          getCairoNowParts(now),
        )
      );
    const cancellation = getStandaloneTripCancellationMode({
      id: child.id ?? "",
      status,
      paymentStatus,
    });
    const showRefundBadge = Boolean(
      child.cancellation?.refundStatus &&
        child.cancellation.refundStatus !== "none",
    );
    const refundOptions = { showRefundBadge };

    switch (status) {
      case "private_ride_offered":
        return result("status.private_ride_offer_pending", "warning");
      case "waiting_list":
        return result("request_status.waiting_for_approval", "warning", {
          canCancel: cancellation.kind !== "blocked",
        });
      case "approved":
        return payable
          ? result("request_status.approved_pay_now", "warning", {
              canPay: true,
              canCancel: cancellation.kind !== "blocked",
            })
          : result("status.expired", "neutral", {
              canCancel: cancellation.kind !== "blocked",
            });
      case "pending_payment":
        return result("status.pending_payment", "warning", {
          canPay: payable,
          canCancel: cancellation.kind !== "blocked",
        });
      case "rejected":
        return result("request_status.rejected", "danger", {
          ...refundOptions,
          secondaryText: child.rejectionReason?.trim() || undefined,
        });
      case "time_out":
        return result("status.expired", "neutral", refundOptions);
      case "submitted":
        return result("status.searching_for_ride", "info", {
          ...refundOptions,
          canCancel: cancellation.kind !== "blocked",
        });
      case "matched":
        return result("status.matched", "info", {
          ...refundOptions,
          canCancel: cancellation.kind !== "blocked",
        });
      case "confirmed":
        return result("status.confirmed", "info", {
          ...refundOptions,
          canCancel: cancellation.kind !== "blocked",
        });
      case "active":
        return result("status.in_progress", "success", {
          ...refundOptions,
          canCancel: cancellation.kind !== "blocked",
        });
      case "completed":
        return result("status.completed", "success", {
          ...refundOptions,
          canRate: true,
        });
      case "no_show":
        return result("status.no_show", "danger", refundOptions);
      case "nomatch":
        return result("status.no_ride_found", "danger", {
          ...refundOptions,
          canCancel: cancellation.kind !== "blocked",
        });
      case "cancelled":
        return result("status.cancelled", "neutral", {
          ...refundOptions,
          secondaryText:
            child.cancelReason?.trim() ||
            child.cancellation?.reason?.trim() ||
            undefined,
        });
      case "refunded":
        return result("status.refunded", "success", refundOptions);
      default:
        return result("status.unknown", "neutral", refundOptions);
    }
  }
  const pastPickup = hasPastTrip(parent, child, now);
  const requestPayment = getRequestPaymentState({
    status:
      parent.status === "pending_payment" && pastPickup
        ? "approved"
        : parent.status,
    paymentStatus: parent.paymentStatus ?? child?.paymentStatus,
    hasPastTrip: pastPickup,
    rejectionReason: parent.rejectionReason,
  });
  const canPay = requestPayment.showPayButton;
  const showRefundBadge = Boolean(
    child?.cancellation?.refundStatus && child.cancellation.refundStatus !== "none",
  );

  if (!child) {
    if (parent.status === "waiting_list") {
      return result("status.waiting_list", "warning");
    }
    if (parent.status === "approved") {
      return result(
        pastPickup ? "status.expired" : "status.pending_payment",
        pastPickup ? "neutral" : "warning",
        {
          canPay,
          ...(!pastPickup ? { secondaryKey: "status.approved_by_admin" } : {}),
        },
      );
    }
    if (parent.status === "rejected") {
      return result("request_status.rejected", "danger", {
        secondaryText: parent.rejectionReason?.trim() || undefined,
      });
    }
    if (parent.status === "submitted") return result("payments.paid", "success");
    if (parent.status === "time_out") return result("status.expired", "neutral");
    if (parent.status === "pending_payment") {
      return result("status.pending_payment", "warning", { canPay });
    }
    return result("status.unknown", "neutral", { canPay });
  }

  if (parent.status === "time_out") {
    return result("status.expired", "neutral", { showRefundBadge });
  }

  if (child.cancelledBy === "admin_rejected" || parent.status === "rejected") {
    return result("request_status.rejected", "danger", {
      secondaryText: parent.rejectionReason?.trim() || child.cancelReason?.trim() || undefined,
    });
  }

  const refundOptions = { showRefundBadge };
  switch (child.status) {
    case "private_ride_offered":
      return result("status.private_ride_offer_pending", "warning");
    case "pending_payment":
      if (parent.status === "waiting_list") {
        return result("status.waiting_list", "warning", refundOptions);
      }
      if (parent.status === "approved") {
        return result(
          pastPickup ? "status.expired" : "status.pending_payment",
          pastPickup ? "neutral" : "warning",
          {
            ...refundOptions,
            canPay,
            ...(!pastPickup ? { secondaryKey: "status.approved_by_admin" } : {}),
          },
        );
      }
      if (parent.status === "time_out") {
        return result("status.expired", "neutral", refundOptions);
      }
      if (parent.status === "rejected") {
        return result("request_status.rejected", "danger", {
          ...refundOptions,
          secondaryText: parent.rejectionReason?.trim() || undefined,
        });
      }
      if (parent.status === "pending_payment" && pastPickup) {
        return result("status.expired", "neutral", refundOptions);
      }
      return result("status.pending_payment", "warning", { ...refundOptions, canPay });
    case "submitted":
      return result("status.searching_for_ride", "info", { ...refundOptions, canCancel: true });
    case "matched":
      return result("status.matched", "info", { ...refundOptions, canCancel: true });
    case "confirmed":
      return result("status.confirmed", "info", { ...refundOptions, canCancel: true });
    case "active":
      return result("status.in_progress", "success", { ...refundOptions, canCancel: true });
    case "completed":
      return result("status.completed", "success", { ...refundOptions, canRate: true });
    case "no_show":
      return result("status.no_show", "danger", refundOptions);
    case "nomatch":
      return result("status.no_ride_found", "danger", refundOptions);
    case "cancelled":
      return child.cancelledBy === "admin_rejected"
        ? result("request_status.rejected", "danger", {
            ...refundOptions,
            secondaryText: child.cancelReason?.trim() || undefined,
          })
        : result("status.cancelled", "neutral", {
            ...refundOptions,
            secondaryText: child.cancelReason?.trim() || child.cancellation?.reason?.trim() || undefined,
          });
    case "refunded":
      return result("status.refunded", "success", refundOptions);
    case "time_out":
      return result("status.expired", "neutral", refundOptions);
    default:
      return result("status.unknown", "neutral", refundOptions);
  }
}

export function getRejectionDisplay({
  request,
  trip,
}: {
  request?: RequestLike | null;
  trip?: TripLike | null;
}): { showReasonCard: boolean; reason: string | null; fallback: boolean } {
  const showReasonCard =
    getDisplayStatus({ request, trip }).key === "request_status.rejected";
  const reason = !showReasonCard
    ? null
    : trip?.isStandalone
      ? trip.rejectionReason?.trim() || null
      : request?.status === "rejected"
      ? request.rejectionReason?.trim() || null
      : trip?.cancelReason?.trim() || null;

  return { showReasonCard, reason, fallback: showReasonCard && !reason };
}