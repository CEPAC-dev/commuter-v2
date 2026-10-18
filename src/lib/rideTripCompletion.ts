export function getCompletableTripIds(
  ridePassengers: readonly { tripId?: unknown; status?: unknown }[],
  trips: readonly { _id: unknown; status?: unknown }[],
): string[] {
  const excludedTripIds = new Set(
    ridePassengers
      .filter((passenger) =>
        ["cancelled", "no_show"].includes(
          String(passenger.status ?? "").toLowerCase(),
        ),
      )
      .map((passenger) => String(passenger.tripId ?? ""))
      .filter(Boolean),
  );

  return trips
    .filter(
      (trip) =>
        trip.status === "active" && !excludedTripIds.has(String(trip._id)),
    )
    .map((trip) => String(trip._id));
}

export function getNoShowTripIds(
  ridePassengers: readonly { tripId?: unknown; status?: unknown }[],
  trips: readonly { _id: unknown; status?: unknown }[],
): string[] {
  const noShowTripIds = new Set(
    ridePassengers
      .filter(
        (passenger) =>
          String(passenger.status ?? "").toLowerCase() === "no_show",
      )
      .map((passenger) => String(passenger.tripId ?? ""))
      .filter(Boolean),
  );

  return trips
    .filter(
      (trip) =>
        noShowTripIds.has(String(trip._id)) &&
        ["matched", "confirmed"].includes(String(trip.status ?? "")),
    )
    .map((trip) => String(trip._id));
}
