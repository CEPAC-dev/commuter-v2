import { Types } from "mongoose";
import { Availability } from "@/models/Availability";
import { Driver } from "@/models/Driver";
import { Ride } from "@/models/Ride";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function minutes(value: string): number {
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
}

function vehicleCompatible(carType: string | undefined, vehicleType: string): boolean {
  if (!carType) return false;
  if (vehicleType === "private_car") return carType === "private";
  if (vehicleType === "taxi_private") return carType === "taxi";
  if (vehicleType === "van_shared") return carType === "van";
  if (vehicleType === "microbus_shared") return carType === "microbus";
  return true;
}

export async function getEligibleDriverIds(ride: {
  _id: unknown;
  date: string;
  startTime: string;
  endTime: string;
  vehicleType: string;
  rejectedByDriverIds?: unknown[];
}): Promise<Types.ObjectId[]> {
  const dayOfWeek = DAY_KEYS[new Date(`${ride.date}T00:00:00Z`).getUTCDay()];
  const availability = await Availability.find({ dayOfWeek, active: true })
    .select("driverId origin startTime endTime")
    .lean<{ driverId: Types.ObjectId; origin: { lat: number; lng: number }; startTime: string; endTime: string }[]>();
  const rejected = new Set((ride.rejectedByDriverIds ?? []).map(String));
  const driverIds = availability.map((item) => item.driverId).filter((id) => !rejected.has(String(id)));
  const drivers = await Driver.find({ userId: { $in: driverIds }, verificationStatus: "verified" })
    .select("userId carType")
    .lean<{ userId: Types.ObjectId; carType?: string }[]>();
  const driverMap = new Map(drivers.map((driver) => [String(driver.userId), driver]));
  const candidates: { id: Types.ObjectId; distance: number }[] = [];
  const start = minutes(ride.startTime);
  const end = minutes(ride.endTime);

  for (const item of availability) {
    const driver = driverMap.get(String(item.driverId));
    if (!driver || !vehicleCompatible(driver.carType, ride.vehicleType)) continue;
    if (minutes(item.startTime) > start || minutes(item.endTime) < end) continue;
    const conflict = await Ride.exists({
      driverId: item.driverId,
      date: ride.date,
      status: { $in: ["confirmed", "active"] },
      startTime: { $lt: ride.endTime },
      endTime: { $gt: ride.startTime },
      _id: { $ne: ride._id },
    });
    if (conflict) continue;
    candidates.push({
      id: item.driverId,
      distance: 0,
    });
  }

  return candidates.sort((a, b) => a.distance - b.distance).map((candidate) => candidate.id);
}
