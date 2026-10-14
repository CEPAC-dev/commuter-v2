export type SeatAllocationInput = {
  capacity: number;
  occupiedSeats: readonly number[];
  requestedCount: number;
  preferredSeats?: readonly number[];
};

export type SeatAllocationResult =
  | { ok: true; seats: number[] }
  | { ok: false; reason: "NOT_ENOUGH_SEATS" | "INVALID_COUNT" };

export type SeatPassengerState = {
  tripId: string;
  status: string;
  seatNumbers?: readonly number[] | null;
  numberOfPassengers?: number;
};

export function allocateSeats({
  capacity,
  occupiedSeats,
  requestedCount,
  preferredSeats = [],
}: SeatAllocationInput): SeatAllocationResult {
  if (
    !Number.isInteger(capacity) ||
    capacity < 1 ||
    !Number.isInteger(requestedCount) ||
    requestedCount < 1
  ) {
    return { ok: false, reason: "INVALID_COUNT" };
  }
  if (requestedCount > capacity) {
    return { ok: false, reason: "NOT_ENOUGH_SEATS" };
  }

  const occupied = new Set(
    occupiedSeats.filter(
      (seat) => Number.isInteger(seat) && seat >= 1 && seat <= capacity,
    ),
  );
  const freeSeats = Array.from({ length: capacity }, (_, index) => index + 1)
    .filter((seat) => !occupied.has(seat));
  if (freeSeats.length < requestedCount) {
    return { ok: false, reason: "NOT_ENOUGH_SEATS" };
  }

  const selected: number[] = [];
  for (const seat of preferredSeats) {
    if (
      Number.isInteger(seat) &&
      seat >= 1 &&
      seat <= capacity &&
      !occupied.has(seat) &&
      !selected.includes(seat)
    ) {
      selected.push(seat);
      if (selected.length === requestedCount) {
        return { ok: true, seats: selected.sort((a, b) => a - b) };
      }
    }
  }

  if (selected.length === 0) {
    for (let start = 1; start <= capacity - requestedCount + 1; start += 1) {
      const contiguous = Array.from(
        { length: requestedCount },
        (_, index) => start + index,
      );
      if (contiguous.every((seat) => !occupied.has(seat))) {
        return { ok: true, seats: contiguous };
      }
    }
  }

  for (const seat of freeSeats) {
    if (!selected.includes(seat)) selected.push(seat);
    if (selected.length === requestedCount) break;
  }

  return selected.length === requestedCount
    ? { ok: true, seats: selected.sort((a, b) => a - b) }
    : { ok: false, reason: "NOT_ENOUGH_SEATS" };
}

export function planBoardingSeatAssignments(input: {
  capacity: number;
  passengers: readonly SeatPassengerState[];
  boardingTripIds: readonly string[];
  releasingTripIds?: readonly string[];
}):
  | { ok: true; assignments: Record<string, number[]> }
  | { ok: false; reason: "NOT_ENOUGH_SEATS" | "INVALID_COUNT" } {
  const releasing = new Set(input.releasingTripIds ?? []);
  const occupiedSeats = input.passengers.flatMap((passenger) => {
    if (
      releasing.has(passenger.tripId) ||
      !["boarding", "on_board", "picked_up"].includes(
        passenger.status.toLowerCase(),
      )
    ) {
      return [];
    }
    return [...(passenger.seatNumbers ?? [])];
  });
  const passengerByTripId = new Map(
    input.passengers.map((passenger) => [passenger.tripId, passenger]),
  );
  const assignments: Record<string, number[]> = {};

  for (const tripId of input.boardingTripIds) {
    const passenger = passengerByTripId.get(tripId);
    if (!passenger) continue;
    if (
      ["boarding", "on_board", "picked_up"].includes(
        passenger.status.toLowerCase(),
      )
    ) {
      assignments[tripId] = [...(passenger.seatNumbers ?? [])];
      continue;
    }
    if (passenger.status.toLowerCase() !== "waiting") continue;

    const allocation = allocateSeats({
      capacity: input.capacity,
      occupiedSeats,
      requestedCount: passenger.numberOfPassengers ?? 1,
      preferredSeats: passenger.seatNumbers ?? [],
    });
    if (!allocation.ok) return allocation;
    assignments[tripId] = allocation.seats;
    occupiedSeats.push(...allocation.seats);
  }

  return { ok: true, assignments };
}
