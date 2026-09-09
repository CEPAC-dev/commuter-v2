import "server-only";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import type { GeoPoint } from "@/types/geo";
import {
  MAX_AVAILABILITY_MINUTES,
  validateAvailabilityWindow,
} from "@/lib/time/availabilityWindow";

export const DAYS_OF_WEEK = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export { MAX_AVAILABILITY_MINUTES, validateAvailabilityWindow } from "@/lib/time/availabilityWindow";

export interface AvailabilityRecord {
  _id: string;
  dayOfWeek: DayOfWeek;
  origin: GeoPoint;
  startTime: string;
  endTime: string;
  active: boolean;
}

export async function listDriverAvailability(
  driverId: string,
): Promise<AvailabilityRecord[]> {
  await connectDB();
  const records = await Availability.find({ driverId }).lean<
    {
      _id: unknown;
      dayOfWeek: DayOfWeek;
      origin: GeoPoint;
      startTime: string;
      endTime: string;
      active: boolean;
    }[]
  >();

  return records.map((record) => ({
    _id: String(record._id),
    dayOfWeek: record.dayOfWeek,
    origin: record.origin,
    startTime: record.startTime,
    endTime: record.endTime,
    active: record.active,
  }));
}


