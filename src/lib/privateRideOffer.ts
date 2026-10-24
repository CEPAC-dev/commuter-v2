export const PRIVATE_RIDE_COUNTERPARTS = {
  taxi_shared: "taxi_private",
  shared_car: "private_car",
} as const;

export type PrivateRideVehicleType =
  (typeof PRIVATE_RIDE_COUNTERPARTS)[keyof typeof PRIVATE_RIDE_COUNTERPARTS];

export type PrivateRideOffer = {
  vehicleType: PrivateRideVehicleType;
  priceEgp: number;
};

export function privateRideCounterpart(
  vehicleType: string,
): PrivateRideVehicleType | null {
  return (
    PRIVATE_RIDE_COUNTERPARTS[
      vehicleType as keyof typeof PRIVATE_RIDE_COUNTERPARTS
    ] ?? null
  );
}

export function serializePrivateRideOffer(
  offer: PrivateRideOffer | null | undefined,
): PrivateRideOffer | null {
  if (!offer) return null;
  return {
    vehicleType: offer.vehicleType,
    priceEgp: offer.priceEgp,
  };
}

export function privateRidePrice(distanceKm: number, rate: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new Error("Trip distance must be a finite non-negative number.");
  }
  if (!Number.isFinite(rate) || rate < 0) {
    throw new Error("Vehicle rate must be a finite non-negative number.");
  }
  return Math.round(distanceKm * rate);
}
