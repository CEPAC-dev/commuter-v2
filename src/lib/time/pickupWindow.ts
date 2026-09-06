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

export interface ArrivalSlot {
  start: string;
  end: string;
  value: string;
}

export const ARRIVAL_SLOT_START_MIN = 6 * 60;
export const ARRIVAL_SLOT_END_MIN = 24 * 60;
export const ARRIVAL_SLOT_STEP_MIN = 30;

export function getArrivalSlots(): ArrivalSlot[] {
  const slots: ArrivalSlot[] = [];
  for (
    let start = ARRIVAL_SLOT_START_MIN;
    start < ARRIVAL_SLOT_END_MIN;
    start += ARRIVAL_SLOT_STEP_MIN
  ) {
    slots.push({
      start: toHHMM(start),
      end: toHHMM(start + ARRIVAL_SLOT_STEP_MIN),
      value: toHHMM(start + ARRIVAL_SLOT_STEP_MIN / 2),
    });
  }
  return slots;
}

/** Full 24h list of 30-min slots — lets a period (AM/PM) picker show each hour once. */
export function getDayHalfHourSlots(): ArrivalSlot[] {
  const slots: ArrivalSlot[] = [];
  for (let start = 0; start < 24 * 60; start += ARRIVAL_SLOT_STEP_MIN) {
    slots.push({
      start: toHHMM(start),
      end: toHHMM(start + ARRIVAL_SLOT_STEP_MIN),
      value: toHHMM(start + ARRIVAL_SLOT_STEP_MIN / 2),
    });
  }
  return slots;
}

export function snapToArrivalSlotMidpoint(hhmm: string): string {
  const minutes = toMinutes(hhmm);
  if (!Number.isFinite(minutes)) return "";
  const clamped = Math.min(
    Math.max(minutes, ARRIVAL_SLOT_START_MIN),
    ARRIVAL_SLOT_END_MIN - 1,
  );
  const slotStart =
    ARRIVAL_SLOT_START_MIN +
    Math.floor((clamped - ARRIVAL_SLOT_START_MIN) / ARRIVAL_SLOT_STEP_MIN) *
      ARRIVAL_SLOT_STEP_MIN;
  return toHHMM(slotStart + ARRIVAL_SLOT_STEP_MIN / 2);
}

/** Pickup window mirrors the arrival slot's width: e.g. arrival 8:00-8:30 → pickup 7:15-7:45. */
export function pickupWindowRange(pickupTime: string): {
  start: string;
  end: string;
} {
  const half = ARRIVAL_SLOT_STEP_MIN / 2;
  return {
    start: toHHMM(toMinutes(pickupTime) - half),
    end: toHHMM(toMinutes(pickupTime) + half),
  };
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
