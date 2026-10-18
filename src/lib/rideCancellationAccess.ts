export type RideCancellationSession = {
  role: string;
  userId: string;
};

export type RideCancellationAccess = "unauthorized" | "forbidden" | "driver" | "admin";
export type DriverRideCancellationDecision =
  | "allowed"
  | "use_incident_report";

export function getRideCancellationAccess(
  session: RideCancellationSession | null,
  rideDriverId: unknown,
): RideCancellationAccess {
  if (!session) return "unauthorized";
  if (session.role === "admin") return "admin";
  if (session.role === "driver" && String(rideDriverId) === session.userId) {
    return "driver";
  }
  return "forbidden";
}

export function getDriverRideCancellationDecision(
  access: RideCancellationAccess,
  rideStatus: string,
): DriverRideCancellationDecision {
  return access === "driver" && rideStatus === "active"
    ? "use_incident_report"
    : "allowed";
}
