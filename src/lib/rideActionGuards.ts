export const RIDE_ACTION_ALLOWED_STATUSES = {
  start_ride: ["confirmed"],
  station_arrived: ["active"],
  boarding_alighting: ["active"],
  pickup_arrived: ["active"],
  passenger_picked_up: ["active"],
  no_show: ["active"],
  stop_point_arrived: ["active"],
  end_ride: ["active"],
} as const;

export type RideActionName = keyof typeof RIDE_ACTION_ALLOWED_STATUSES;

export type RideActionStatusDecision =
  | { kind: "allowed"; expectedStatus: string }
  | { kind: "idempotent" }
  | { kind: "conflict" }
  | { kind: "unknown_action" };

export function getRideActionStatusDecision(
  action: string,
  status: string,
): RideActionStatusDecision {
  if (!Object.prototype.hasOwnProperty.call(RIDE_ACTION_ALLOWED_STATUSES, action)) {
    return { kind: "unknown_action" };
  }
  if (action === "start_ride" && status === "active") {
    return { kind: "idempotent" };
  }
  if (action === "end_ride" && status === "completed") {
    return { kind: "idempotent" };
  }

  const allowedStatuses =
    RIDE_ACTION_ALLOWED_STATUSES[action as RideActionName] as readonly string[];
  return allowedStatuses.includes(status)
    ? { kind: "allowed", expectedStatus: status }
    : { kind: "conflict" };
}
