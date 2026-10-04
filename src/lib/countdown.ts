import { getPickupInstant } from "./time/cairoTime.ts";

export type Countdown = {
  state: "future" | "reached";
  totalSeconds: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  tickMs: number;
};

export function getCountdown({
  pickupAt,
  now,
}: {
  pickupAt: string;
  now: Date;
}): Countdown | null {
  if (typeof pickupAt !== "string" || !pickupAt.trim() || !Number.isFinite(now.getTime())) {
    return null;
  }

  const isoParts = pickupAt.match(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/,
  );
  if (!isoParts) return null;
  const dateStart = Date.parse(`${isoParts[1]}T00:00:00.000Z`);
  if (
    !Number.isFinite(dateStart) ||
    new Date(dateStart).toISOString().slice(0, 10) !== isoParts[1] ||
    Number(isoParts[2]) > 23 ||
    Number(isoParts[3]) > 59 ||
    Number(isoParts[4]) > 59
  ) {
    return null;
  }

  const pickupTime = Date.parse(pickupAt);
  if (!Number.isFinite(pickupTime)) return null;

  const state = pickupTime <= now.getTime() ? "reached" : "future";
  const totalSeconds = state === "reached"
    ? 0
    : Math.ceil((pickupTime - now.getTime()) / 1000);
  return {
    state,
    totalSeconds,
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    tickMs: totalSeconds < 3600 ? 1000 : 60000,
  };
}

export function getCairoPickupAt(trip: {
  date: string;
  pickupTime: string;
}): string | null {
  return getPickupInstant(trip)?.toISOString() ?? null;
}