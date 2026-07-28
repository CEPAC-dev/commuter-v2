import {
  VEHICLES,
  type VehicleKey,
  type VehicleConfig,
} from "@/lib/config/vehicles";

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
export function toHHMM(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Pickup time = arrival − duration − vehicle window (margin minutes). */
export function computePickupTime(
  arrivalTime: string, // "HH:MM"
  durationMinutes: number,
  vehicle: VehicleKey,
  vehiclesMap: Record<VehicleKey, VehicleConfig> = VEHICLES,
): string {
  const { window } = vehiclesMap[vehicle];
  return toHHMM(toMinutes(arrivalTime) - durationMinutes - window);
}

/** Private arrival = pickup + drive + stop waits + fixed arrival buffer. */
export function computeArrivalTime(
  pickupTime: string,
  driveMinutes: number,
  waitingMinutes: number,
  bufferMinutes = 10,
): string {
  return toHHMM(
    toMinutes(pickupTime) +
      Math.max(0, driveMinutes) +
      Math.max(0, waitingMinutes) +
      Math.max(0, bufferMinutes),
  );
}
