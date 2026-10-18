export interface RequestPromoReleaseTrip {
  id: string;
  status: string;
  paymentStatus: string;
}

export interface RequestPromoReleaseState {
  status: string;
  paymentStatus: string;
}

export interface RequestPromoReleaseStore {
  getRequest(requestId: string): Promise<RequestPromoReleaseState | null>;
  findTripsForRequest(requestId: string): Promise<RequestPromoReleaseTrip[]>;
  releaseTrip(tripId: string): Promise<number>;
}

const TERMINAL_REQUEST_STATUSES = new Set(["rejected", "cancelled", "time_out"]);
const TERMINAL_TRIP_STATUSES = new Set(["cancelled", "rejected", "time_out"]);

export async function releasePromoForRequestWith(
  store: RequestPromoReleaseStore,
  requestId: string,
): Promise<number> {
  const request = await store.getRequest(requestId);
  if (!request || request.paymentStatus === "paid") return 0;

  const requestIsTerminal = TERMINAL_REQUEST_STATUSES.has(request.status);
  const trips = await store.findTripsForRequest(requestId);
  let released = 0;
  for (const trip of trips) {
    if (trip.paymentStatus === "paid") continue;
    if (!requestIsTerminal && !TERMINAL_TRIP_STATUSES.has(trip.status)) continue;
    released += await store.releaseTrip(trip.id);
  }
  return released;
}
