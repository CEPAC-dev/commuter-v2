export type RideCancellationSession = {
  role: string;
  userId: string;
};

export type RideCancellationAccess = "unauthorized" | "forbidden" | "driver" | "admin";

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
