import { getCairoNowParts, getPickupInstant } from "./time/cairoTime.ts";

export const PRIVATE_RIDE_COUNTERPARTS = {
  taxi_shared: "taxi_private",
  shared_car: "private_car",
} as const;

export type PrivateRideVehicleType =
  (typeof PRIVATE_RIDE_COUNTERPARTS)[keyof typeof PRIVATE_RIDE_COUNTERPARTS];

export type PrivateRideOffer = {
  vehicleType: PrivateRideVehicleType;
  priceEgp: number;
  expiresAt?: Date | string | null;
  offeredAt?: Date | string | null;
};

export function privateRideOfferExpiresAt(offeredAt: Date | string): Date {
  const offeredAtDate = new Date(offeredAt);
  if (!Number.isFinite(offeredAtDate.getTime())) {
    throw new Error("Private-ride offer time must be a valid date.");
  }

  const { dateStr, timeStr } = getCairoNowParts(offeredAtDate);
  const [year, month, day] = dateStr.split("-").map(Number);
  const deadlineDate =
    timeStr >= "19:00"
      ? new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10)
      : dateStr;
  const expiresAt = getPickupInstant({
    date: deadlineDate,
    pickupTime: "19:00",
  });
  if (!expiresAt) {
    throw new Error("Could not calculate the private-ride offer deadline.");
  }
  return expiresAt;
}

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
): {
  vehicleType: PrivateRideVehicleType;
  priceEgp: number;
  expiresAt: string | null;
} | null {
  if (!offer) return null;
  const expiresAt = offer.expiresAt
    ? new Date(offer.expiresAt)
    : offer.offeredAt
      ? privateRideOfferExpiresAt(offer.offeredAt)
      : null;
  return {
    vehicleType: offer.vehicleType,
    priceEgp: offer.priceEgp,
    expiresAt:
      expiresAt && Number.isFinite(expiresAt.getTime())
        ? expiresAt.toISOString()
        : null,
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
