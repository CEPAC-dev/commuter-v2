import "server-only";
import { Types } from "mongoose";
import { DriverLocation } from "@/models/DriverLocation";

export const DRIVER_LOCATION_MIN_INTERVAL_MS = 3_000;
export const DRIVER_LOCATION_STALE_MS = 45_000;
const DRIVER_LOCATION_RETENTION_MS = 5 * 60_000;

export type DriverLocationSubject = "ride" | "trip";

export interface DriverLocationValue {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  recordedAt: Date;
  receivedAt: Date;
}

export interface DriverLocationSnapshot extends DriverLocationValue {
  ageSeconds: number;
  stale: boolean;
}

export async function saveDriverLocation(input: {
  subjectType: DriverLocationSubject;
  subjectId: string;
  driverId: string;
  location: DriverLocationValue;
  now: Date;
}): Promise<void> {
  const key = {
    subjectType: input.subjectType,
    subjectId: new Types.ObjectId(input.subjectId),
  };
  await DriverLocation.updateOne(
    key,
    {
      $set: {
        ...input.location,
        driverId: new Types.ObjectId(input.driverId),
        receivedAt: input.now,
        expiresAt: new Date(input.now.getTime() + DRIVER_LOCATION_RETENTION_MS),
      },
    },
    { upsert: true, runValidators: true },
  );
}

export async function readDriverLocation(
  subjectType: DriverLocationSubject,
  subjectId: string,
  now = new Date(),
): Promise<DriverLocationSnapshot | null> {
  if (!Types.ObjectId.isValid(subjectId)) return null;
  const location = await DriverLocation.findOne({
    subjectType,
    subjectId: new Types.ObjectId(subjectId),
    expiresAt: { $gt: now },
  })
    .select("lat lng accuracy heading speed recordedAt receivedAt")
    .lean<{
      lat: number;
      lng: number;
      accuracy?: number;
      heading?: number;
      speed?: number;
      recordedAt: Date;
      receivedAt: Date;
    } | null>();

  if (!location) return null;
  const ageSeconds = Math.max(
    0,
    Math.floor((now.getTime() - location.receivedAt.getTime()) / 1_000),
  );
  return {
    lat: location.lat,
    lng: location.lng,
    accuracy: location.accuracy ?? null,
    heading: location.heading ?? null,
    speed: location.speed ?? null,
    recordedAt: location.recordedAt,
    receivedAt: location.receivedAt,
    ageSeconds,
    stale: ageSeconds * 1_000 >= DRIVER_LOCATION_STALE_MS,
  };
}
