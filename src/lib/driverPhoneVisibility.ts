type IdLike = unknown;

export type DriverPhoneTrip = {
  _id?: IdLike;
  userId?: IdLike;
  driverId?: IdLike;
  rideId?: IdLike;
  status?: string | null;
};

export type DriverPhoneRide = {
  _id?: IdLike;
  driverId?: IdLike;
  status?: string | null;
  passengers?: Array<{
    tripId?: IdLike;
    status?: string | null;
  }> | null;
};

export type DriverPhoneVisibility = {
  allowed: boolean;
  reason:
    | "allowed"
    | "ride_missing"
    | "not_owner"
    | "trip_not_linked"
    | "driver_missing"
    | "driver_reassigned"
    | "ride_not_live"
    | "trip_ended"
    | "passenger_not_in_ride";
};

const LIVE_RIDE_STATUSES = new Set(["confirmed", "active"]);
const HIDDEN_TRIP_STATUSES = new Set([
  "cancelled",
  "completed",
  "refunded",
  "nomatch",
  "expired",
  "time_out",
]);

function sameId(left: IdLike, right: IdLike): boolean {
  return left != null && right != null && String(left) === String(right);
}

export function canPassengerSeeDriverPhone(input: {
  userId: IdLike;
  trip: DriverPhoneTrip;
  ride: DriverPhoneRide | null | undefined;
}): DriverPhoneVisibility {
  const { userId, trip, ride } = input;
  if (!ride) return { allowed: false, reason: "ride_missing" };
  if (!sameId(trip.userId, userId)) {
    return { allowed: false, reason: "not_owner" };
  }
  if (!sameId(trip.rideId, ride._id)) {
    return { allowed: false, reason: "trip_not_linked" };
  }
  if (!ride.driverId) {
    return { allowed: false, reason: "driver_missing" };
  }
  if (trip.driverId && !sameId(trip.driverId, ride.driverId)) {
    return { allowed: false, reason: "driver_reassigned" };
  }
  if (!LIVE_RIDE_STATUSES.has(ride.status ?? "")) {
    return { allowed: false, reason: "ride_not_live" };
  }
  if (HIDDEN_TRIP_STATUSES.has(trip.status ?? "")) {
    return { allowed: false, reason: "trip_ended" };
  }
  const passengerStillOnRide = (ride.passengers ?? []).some(
    (passenger) =>
      sameId(passenger.tripId, trip._id) &&
      passenger.status?.toLowerCase() !== "cancelled",
  );
  if (!passengerStillOnRide) {
    return { allowed: false, reason: "passenger_not_in_ride" };
  }
  return { allowed: true, reason: "allowed" };
}

/** Omit any stale snapshot phone and add only the current driver's phone. */
export function serializePassengerAssignedDriver<
  T extends { phone?: string | null },
>(
  assignedDriver: T | null | undefined,
  visibility: DriverPhoneVisibility,
  currentDriverPhone?: string | null,
): Omit<T, "phone"> & { phone?: string } | null | undefined {
  if (!assignedDriver) return assignedDriver;
  const otherDriverDetails = { ...assignedDriver };
  Reflect.deleteProperty(otherDriverDetails, "phone");
  if (!visibility.allowed || !currentDriverPhone) {
    return otherDriverDetails as Omit<T, "phone">;
  }
  return {
    ...otherDriverDetails,
    phone: currentDriverPhone,
  } as Omit<T, "phone"> & { phone: string };
}
