export const CHAT_GRACE_MINUTES = 30;

type ChatSession = {
  userId: string;
  role: "passenger" | "driver" | "admin";
};

type ChatTrip = {
  _id: unknown;
  userId: unknown;
  rideId?: unknown;
  status: string;
};

type ChatRide = {
  _id: unknown;
  driverId?: unknown;
  status: string;
  completedAt?: Date | string | null;
  passengers?: Array<{
    tripId?: unknown;
    status?: string | null;
  }>;
};

export type TripChatAccess = {
  allowed: boolean;
  role: "passenger" | "driver" | "admin";
  canWrite: boolean;
  reason:
    | "allowed"
    | "admin_read_only"
    | "not_participant"
    | "chat_closed";
};

export function getTripChatAccess({
  session,
  trip,
  ride,
  now = new Date(),
}: {
  session: ChatSession | null;
  trip: ChatTrip;
  ride: ChatRide | null;
  now?: Date;
}): TripChatAccess {
  const role = session?.role ?? "passenger";
  const denied = (
    reason: TripChatAccess["reason"],
  ): TripChatAccess => ({
    allowed: false,
    role,
    canWrite: false,
    reason,
  });

  if (!session) return denied("not_participant");
  if (session.role === "admin") {
    return {
      allowed: true,
      role: "admin",
      canWrite: false,
      reason: "admin_read_only",
    };
  }

  const passenger = String(trip.userId) === session.userId;
  const rideAssigned = Boolean(ride?.driverId);
  const driver = Boolean(
    session.role === "driver" &&
      ride &&
      String(ride.driverId) === session.userId &&
      String(trip.rideId) === String(ride._id) &&
      ride.passengers?.some(
        (entry) =>
          String(entry.tripId) === String(trip._id) &&
          !["cancelled", "no_show"].includes(
            String(entry.status ?? "").toLowerCase(),
          ),
      ),
  );

  if (!passenger && !driver) return denied("not_participant");
  const participantRole = driver ? "driver" : "passenger";
  const closed =
    !ride ||
    !rideAssigned ||
    String(trip.status).toLowerCase() === "cancelled" ||
    String(ride.status).toLowerCase() === "cancelled" ||
    !["confirmed", "active", "completed"].includes(
      String(ride.status).toLowerCase(),
    );

  if (closed) {
    return {
      allowed: false,
      role: participantRole,
      canWrite: false,
      reason: "chat_closed",
    };
  }

  if (String(ride.status).toLowerCase() === "completed") {
    const completedAt = ride.completedAt
      ? new Date(ride.completedAt).getTime()
      : Number.NaN;
    const graceEndsAt = completedAt + CHAT_GRACE_MINUTES * 60_000;
    if (!Number.isFinite(completedAt) || now.getTime() >= graceEndsAt) {
      return {
        allowed: false,
        role: participantRole,
        canWrite: false,
        reason: "chat_closed",
      };
    }
  }

  return {
    allowed: true,
    role: participantRole,
    canWrite: true,
    reason: "allowed",
  };
}
