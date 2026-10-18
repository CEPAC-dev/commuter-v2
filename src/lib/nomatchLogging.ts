export function selectModifiedNomatchTrips<
  T extends { _id: unknown },
>(candidates: readonly T[], modifiedTripIds: readonly string[]): T[] {
  const modifiedIds = new Set(modifiedTripIds);
  return candidates.filter((trip) => modifiedIds.has(String(trip._id)));
}
