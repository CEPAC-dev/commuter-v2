export const INCIDENT_RESOLUTION_ACTIONS = [
  "continue",
  "cancel_no_penalty",
  "cancel_with_penalty",
] as const;

export type IncidentResolutionAction =
  (typeof INCIDENT_RESOLUTION_ACTIONS)[number];

export type IncidentResolutionDecision =
  | { kind: "allowed"; action: IncidentResolutionAction; adminNote: string; penaltyEgp: number }
  | { kind: "already_resolved" }
  | { kind: "invalid_action" }
  | { kind: "note_required" }
  | { kind: "note_too_long" }
  | { kind: "ride_status_conflict" }
  | { kind: "invalid_penalty" }
  | { kind: "penalty_too_large" };

export function getIncidentResolutionDecision(input: {
  incidentStatus: string;
  rideStatus: string;
  action: unknown;
  adminNote: unknown;
  penaltyEgp: unknown;
  maxPenaltyEgp: number;
}): IncidentResolutionDecision {
  if (input.incidentStatus !== "open") return { kind: "already_resolved" };
  if (
    typeof input.action !== "string" ||
    !INCIDENT_RESOLUTION_ACTIONS.includes(
      input.action as IncidentResolutionAction,
    )
  ) {
    return { kind: "invalid_action" };
  }

  const adminNote =
    typeof input.adminNote === "string" ? input.adminNote.trim() : "";
  if (!adminNote) return { kind: "note_required" };
  if (adminNote.length > 500) return { kind: "note_too_long" };

  const action = input.action as IncidentResolutionAction;
  if (
    input.rideStatus === "cancelled" ||
    (action !== "continue" &&
      !["confirmed", "active"].includes(input.rideStatus))
  ) {
    return { kind: "ride_status_conflict" };
  }

  let penaltyEgp = 0;
  if (action === "cancel_with_penalty") {
    if (
      typeof input.penaltyEgp !== "number" ||
      !Number.isFinite(input.penaltyEgp) ||
      input.penaltyEgp < 0
    ) {
      return { kind: "invalid_penalty" };
    }
    if (
      !Number.isFinite(input.maxPenaltyEgp) ||
      input.maxPenaltyEgp < 0 ||
      input.penaltyEgp > input.maxPenaltyEgp
    ) {
      return { kind: "penalty_too_large" };
    }
    penaltyEgp = Math.round((input.penaltyEgp + Number.EPSILON) * 100) / 100;
  }

  return { kind: "allowed", action, adminNote, penaltyEgp };
}

const PICKED_UP_OR_FINISHED_PICKUP_STATES = new Set([
  "boarding",
  "on_board",
  "picked_up",
  "dropped_off",
]);
const RESETTABLE_TRIP_STATUSES = new Set(["matched", "confirmed", "active"]);

export function shouldResetTripForIncidentCancellation(
  tripStatus: string,
  pickupStatus: string,
): boolean {
  return (
    RESETTABLE_TRIP_STATUSES.has(tripStatus) &&
    !PICKED_UP_OR_FINISHED_PICKUP_STATES.has(pickupStatus)
  );
}

export function needsIncidentFollowUp(
  tripStatus: string,
  pickupStatus: string,
): boolean {
  return (
    tripStatus === "completed" ||
    PICKED_UP_OR_FINISHED_PICKUP_STATES.has(pickupStatus)
  );
}

export interface AdminRideCancellationTrip {
  id: string;
  status: string;
  pickupStatus: string;
}

export function getAdminRideCancellationPlan(
  trips: readonly AdminRideCancellationTrip[],
) {
  const resetTripIds: string[] = [];
  const preservedTripIds: string[] = [];

  for (const trip of trips) {
    if (
      trip.status === "no_show" ||
      trip.pickupStatus === "no_show" ||
      !shouldResetTripForIncidentCancellation(
        trip.status,
        trip.pickupStatus,
      )
    ) {
      preservedTripIds.push(trip.id);
    } else {
      resetTripIds.push(trip.id);
    }
  }

  return { resetTripIds, preservedTripIds };
}
