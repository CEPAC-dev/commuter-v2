import { getRideCancellationAccess } from "./rideCancellationAccess.ts";

export type RideReadSession = {
  role: string;
  userId: string;
};

export type RideReadAccess =
  | "unauthenticated"
  | "admin"
  | "driver"
  | "passenger"
  | "forbidden";

export function getRideReadAccess(input: {
  session: RideReadSession | null;
  rideDriverId: unknown;
  hasNonCancelledPassengerTrip: boolean;
}): RideReadAccess {
  const { session, rideDriverId, hasNonCancelledPassengerTrip } = input;
  if (!session) return "unauthenticated";
  const roleAccess = getRideCancellationAccess(session, rideDriverId);
  if (roleAccess === "admin" || roleAccess === "driver") return roleAccess;
  if (session.role === "passenger" && hasNonCancelledPassengerTrip) {
    return "passenger";
  }
  return "forbidden";
}

export function projectPassengerRide<
  T extends {
    passengers: Array<{
      tripId?: unknown;
      status?: string | null;
      numberOfPassengers?: number;
    }>;
    passengerCount?: number;
    chatTripId?: unknown;
  },
>(
  ride: T,
  passengerTripIds: readonly string[],
):
  | Omit<T, "passengers" | "passengerCount" | "chatTripId"> & {
      passengers: T["passengers"];
      passengerCount: number;
      chatTripId: string | null;
    }
  | null {
  const ownTrips = new Set(passengerTripIds);
  const passengers = ride.passengers.filter(
    (passenger) =>
      ownTrips.has(String(passenger.tripId)) &&
      passenger.status?.toLowerCase() !== "cancelled",
  );
  if (passengers.length === 0) return null;

  return {
    ...ride,
    passengers,
    passengerCount: passengers.reduce(
      (count, passenger) =>
        count + Math.max(1, passenger.numberOfPassengers ?? 1),
      0,
    ),
    chatTripId: String(passengers[0].tripId),
  };
}
