import "server-only";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import { Station } from "@/models/Station";
import type { RegionCode } from "@/lib/config/regions";
import { findNearestStation } from "@/lib/geo/stations";
import type { GeoPoint } from "@/types/geo";

export const DAYS_OF_WEEK = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export { MAX_AVAILABILITY_MINUTES, validateAvailabilityWindow } from "@/lib/time/availabilityWindow";

export interface AvailabilityRecord {
  _id: string;
  dayOfWeek: DayOfWeek;
  origin: GeoPoint;
  startNearestStation?: { id: number; lat: number; lng: number; name: string } | null;
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
      dayOfWeek: DayOfWeek;
      origin: GeoPoint;
      startNearestStation?: { id: number; lat: number; lng: number; name: string } | null;
      startTime: string;
      endTime: string;
      active: boolean;
    }[]
  >();

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

  const recordsWithStations = records.map((record) => {
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

    return { record, startNearestStation };
  });

  const incompleteStationRecords = recordsWithStations.filter(
    ({ record, startNearestStation }) =>
      startNearestStation &&
      (!record.startNearestStation ||
        !Number.isFinite(record.startNearestStation.lat) ||
        !Number.isFinite(record.startNearestStation.lng)),
  );
  if (incompleteStationRecords.length > 0) {
    await Availability.bulkWrite(
      incompleteStationRecords.map(({ record, startNearestStation }) => ({
        updateOne: {
          filter: { _id: record._id },
          update: { $set: { startNearestStation } },
        },
      })),
    );
  }

  return recordsWithStations.map(({ record, startNearestStation }) => ({
    _id: String(record._id),
    dayOfWeek: record.dayOfWeek,
    origin: record.origin,
    startNearestStation,
    startTime: record.startTime,
    endTime: record.endTime,
    active: record.active,
  }));
}


