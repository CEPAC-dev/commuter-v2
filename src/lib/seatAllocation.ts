export type SeatAllocationInput = {
  capacity: number;
  occupiedSeats: readonly number[];
  requestedCount: number;
  preferredSeats?: readonly number[];
};

export type SeatAllocationResult =
  | { ok: true; seats: number[] }
  | { ok: false; reason: "NOT_ENOUGH_SEATS" | "INVALID_COUNT" };

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
