import { Types } from "mongoose";
import { Availability } from "@/models/Availability";
import { Driver } from "@/models/Driver";
import { Ride } from "@/models/Ride";
import { getAdminSettings } from "@/lib/cancellationPolicy";

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

type StationPoint = { lat: number; lng: number };

function haversineKm(first: StationPoint, second: StationPoint): number {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(second.lat - first.lat);
  const deltaLng = toRadians(second.lng - first.lng);
  const lat1 = toRadians(first.lat);
  const lat2 = toRadians(second.lat);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function getEligibleDriverIds(ride: {
  _id: unknown;
  date: string;
  startTime: string;
  endTime: string;
  vehicleType: string;
  rejectedByDriverIds?: unknown[];
  pickupStation?: StationPoint;
  dropoffStation?: StationPoint;
  passengers?: { pickupStation?: StationPoint; dropoffStation?: StationPoint }[];
}): Promise<Types.ObjectId[]> {
  const settings = await getAdminSettings();
  const dayOfWeek = DAY_KEYS[new Date(`${ride.date}T00:00:00Z`).getUTCDay()];
  const availability = await Availability.find({ dayOfWeek, active: true })
    .select("driverId origin startNearestStation destinationNearestStation startTime endTime")
    .lean<{
      driverId: Types.ObjectId;
      origin: { lat: number; lng: number };
      startNearestStation?: StationPoint | null;
      destinationNearestStation?: StationPoint | null;
      startTime: string;
      endTime: string;
    }[]>();
  const rejected = new Set((ride.rejectedByDriverIds ?? []).map(String));
  const driverIds = availability.map((item) => item.driverId).filter((id) => !rejected.has(String(id)));
  const drivers = await Driver.find({ userId: { $in: driverIds }, verificationStatus: "verified" })
    .select("userId carType")
    .lean<{ userId: Types.ObjectId; carType?: string }[]>();
  const driverMap = new Map(drivers.map((driver) => [String(driver.userId), driver]));
  const candidates: { id: Types.ObjectId; distance: number }[] = [];
  const start = minutes(ride.startTime);
  const end = minutes(ride.endTime);
  const ridePickupStation =
    ride.pickupStation ?? ride.passengers?.find((passenger) => passenger.pickupStation)?.pickupStation;
  const rideDropoffStation =
    ride.dropoffStation ?? ride.passengers?.find((passenger) => passenger.dropoffStation)?.dropoffStation;

  for (const item of availability) {
    const driver = driverMap.get(String(item.driverId));
    if (!driver || !vehicleCompatible(driver.carType, ride.vehicleType)) continue;
    if (minutes(item.startTime) > start || minutes(item.endTime) < end) continue;
    if (
      settings.broadcastOriginFilter.enabled &&
      ridePickupStation &&
      item.startNearestStation &&
      haversineKm(ridePickupStation, item.startNearestStation) >
        settings.broadcastOriginFilter.radiusKm
    )
      continue;
    if (
      settings.broadcastDestinationFilter.enabled &&
      rideDropoffStation &&
      item.destinationNearestStation &&
      haversineKm(rideDropoffStation, item.destinationNearestStation) >
        settings.broadcastDestinationFilter.radiusKm
    )
      continue;
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
