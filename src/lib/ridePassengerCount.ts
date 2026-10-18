export function countRidePassengers(
  passengerCounts: readonly (number | null | undefined)[],
): number {
  return passengerCounts.reduce<number>(
    (total, count) => total + Math.max(1, Math.floor(Number(count) || 1)),
    0,
  );
}

export function decrementRidePassengerCount(
  currentCount: number,
  cancelledPeople: number,
): number {
  const normalizedCount =
    Number.isFinite(currentCount) && currentCount > 0
      ? Math.floor(currentCount)
      : 0;
  const normalizedDecrement =
    Number.isFinite(cancelledPeople) && cancelledPeople > 0
      ? Math.floor(cancelledPeople)
      : 0;
  return Math.max(0, normalizedCount - normalizedDecrement);
}
