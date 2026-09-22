import "server-only";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import { Station } from "@/models/Station";
import type { RegionCode } from "@/lib/config/regions";
import { findNearestStation } from "@/lib/geo/stations";
import type { GeoPoint } from "@/types/geo";
import {
  normalizeAvailabilityDestination,
  normalizeAvailabilityOrigin,
} from "@/lib/time/availabilityWindow";

export const DAYS_OF_WEEK = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export { MAX_AVAILABILITY_MINUTES, validateAvailabilityWindow } from "@/lib/time/availabilityWindow";

export interface AvailabilityRecord {
  _id: string;
  dayOfWeek: DayOfWeek;
  origin: GeoPoint;
  destination?: GeoPoint | null;
  startNearestStation?: { id: number; lat: number; lng: number; name: string } | null;
  destinationNearestStation?: { id: number; lat: number; lng: number; name: string } | null;
  startTime: string;
  endTime: string;
  active: boolean;
}

export async function listDriverAvailability(
  driverId: string,
  regionCode: RegionCode,
): Promise<AvailabilityRecord[]> {
  await connectDB();
  const records = await Availability.find({ driverId }).lean<
    {
      _id: unknown;
      dayOfWeek?: DayOfWeek;
      origin?: unknown;
      destination?: unknown;
      startLocation?: unknown;
      endLocation?: unknown;
      startNearestStation?: { id: number; lat: number; lng: number; name: string } | null;
      destinationNearestStation?: { id: number; lat: number; lng: number; name: string } | null;
      startTime?: string;
      endTime?: string;
      active?: boolean;
    }[]
  >();

  const validRecords = records.flatMap((record): AvailabilityRecord[] => {
    const origin = normalizeAvailabilityOrigin(record.origin ?? record.startLocation);
    const destination = normalizeAvailabilityDestination(
      record.destination ?? record.endLocation,
    );
    const dayOfWeek = record.dayOfWeek;
    const startTime = record.startTime;
    const endTime = record.endTime;

    if (!origin || !dayOfWeek || !DAYS_OF_WEEK.includes(dayOfWeek) || !startTime || !endTime) {
      console.warn("Skipping malformed driver availability record", {
        id: String(record._id),
        driverId,
      });
      return [];
    }

    return [
      {
        _id: String(record._id),
        dayOfWeek,
        origin,
        destination,
        startNearestStation: record.startNearestStation ?? null,
        destinationNearestStation: record.destinationNearestStation ?? null,
        startTime,
        endTime,
        active: record.active ?? true,
      },
    ];
  });

  const stations = await Station.find({ active: true, regionCode })
    .select("objectId name direction stationType zones description landmark lat lng")
    .lean();
  const stationData = stations.map((station) => ({
    id: station.objectId,
    name: station.name,
    direction: station.direction,
    stationType: station.stationType,
    zones: station.zones,
    description: station.description,
    landmark: station.landmark,
    lat: station.lat,
    lng: station.lng,
    popupInfo: "",
  }));

  const recordsWithStations = validRecords.map((record) => {
    const nearestStation = findNearestStation(
      record.origin.lat,
      record.origin.lng,
      stationData,
    );
    const startNearestStation = nearestStation
      ? {
          id: nearestStation.id,
          lat: nearestStation.lat,
          lng: nearestStation.lng,
          name: nearestStation.name,
        }
      : null;
    const destinationNearest = record.destination
      ? findNearestStation(record.destination.lat, record.destination.lng, stationData)
      : null;
    const destinationNearestStation = destinationNearest
      ? {
          id: destinationNearest.id,
          lat: destinationNearest.lat,
          lng: destinationNearest.lng,
          name: destinationNearest.name,
        }
      : null;

    return { record, startNearestStation, destinationNearestStation };
  });

  const incompleteStationRecords = recordsWithStations.filter(
    ({ record, startNearestStation, destinationNearestStation }) =>
      ((startNearestStation &&
        (!record.startNearestStation ||
        !Number.isFinite(record.startNearestStation.lat) ||
        !Number.isFinite(record.startNearestStation.lng))) ||
        (destinationNearestStation &&
          (!record.destinationNearestStation ||
            !Number.isFinite(record.destinationNearestStation.lat) ||
            !Number.isFinite(record.destinationNearestStation.lng)))),
  );
  if (incompleteStationRecords.length > 0) {
    await Availability.bulkWrite(
      incompleteStationRecords.map(({ record, startNearestStation, destinationNearestStation }) => ({
        updateOne: {
          filter: { _id: record._id },
          update: { $set: { startNearestStation, destinationNearestStation } },
        },
      })),
    );
  }

  return recordsWithStations.map(({ record, startNearestStation, destinationNearestStation }) => ({
    _id: String(record._id),
    dayOfWeek: record.dayOfWeek,
    origin: record.origin,
    destination: record.destination,
    startNearestStation,
    destinationNearestStation,
    startTime: record.startTime,
    endTime: record.endTime,
    active: record.active ?? true,
  }));
}


