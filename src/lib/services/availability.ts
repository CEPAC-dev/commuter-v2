import "server-only";
import { connectDB } from "@/lib/db/mongoose";
import { Availability } from "@/models/Availability";
import type { GeoPoint } from "@/types/geo";

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function closeExpiredAvailability() {
  await connectDB();
  const today = getTodayDateString();
  await Availability.updateMany(
    { date: { $lt: today }, status: { $ne: "closed" } },
    { $set: { status: "closed" } },
  );
}

export interface AvailabilityRecord {
  _id: string;
  availabilityNumber: number;
  date: string;
  startLocation: GeoPoint;
  endLocation: GeoPoint;
  startTime: string;
  endTime: string;
  status: string;
}

export async function listDriverAvailability(
  driverId: string,
): Promise<AvailabilityRecord[]> {
  await closeExpiredAvailability();
  await connectDB();
  const records = await Availability.find({ driverId }).sort({ date: 1 }).lean<
    {
      _id: unknown;
      availabilityNumber: number;
      date: string;
      startLocation: GeoPoint;
      endLocation: GeoPoint;
      startTime: string;
      endTime: string;
      status: string;
    }[]
  >();

  return records.map((record) => ({
    _id: String(record._id),
    availabilityNumber: record.availabilityNumber,
    date: record.date,
    startLocation: record.startLocation,
    endLocation: record.endLocation,
    startTime: record.startTime,
    endTime: record.endTime,
    status: record.status,
  }));
}
