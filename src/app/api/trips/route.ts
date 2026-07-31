import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { nextSequence } from "@/models/Counter";
import { Station } from "@/models/Station";
import {
  VEHICLES,
  computeTripPriceEgp,
  type VehicleKey,
} from "@/lib/config/vehicles";
import { isDateInWindow } from "@/lib/time/bookingDates";
import { getVehicles } from "@/lib/db/getVehicles";
import {
  findNearestStations,
  findNearestStation,
  type Station as GeoStation,
  type StationOption,
} from "@/lib/geo/stations";
import type { StopInput, TripInput } from "@/types/forms";
import type { PaymentStatus } from "@/types/booking";
import { listUserTrips } from "@/lib/services/trips";
import { Types } from "mongoose";

const PRIVATE_VEHICLE_KEYS = new Set<VehicleKey>([
  "private_car",
  "taxi_private",
]);

function stationPayload(
  station: Pick<GeoStation, "id" | "lat" | "lng" | "name">,
) {
  return {
    id: station.id,
    lat: station.lat,
    lng: station.lng,
    name: station.name,
  };
}

const PAYMENT_STATUSES = new Set<PaymentStatus>([
  "pending",
  "paid",
  "failed",
  "refunded",
  "expired",
]);

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const requestedPage = Number(searchParams.get("page") ?? "1");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const payment = searchParams.get("paymentStatus");
  const vehicleType = searchParams.get("vehicleType");

  if (payment && !PAYMENT_STATUSES.has(payment as PaymentStatus)) {
    return NextResponse.json(
      { error: "Invalid paymentStatus" },
      { status: 400 },
    );
  }
  if (vehicleType && !(vehicleType in VEHICLES)) {
    return NextResponse.json({ error: "Invalid vehicleType" }, { status: 400 });
  }

  const result = await listUserTrips(session.userId, {
    page,
    paymentStatus: payment as PaymentStatus | undefined,
    vehicleType: vehicleType ?? undefined,
  });
  return NextResponse.json({
    data: result.rows,
    page: result.page,
    pageSize: 12,
    total: result.total,
    totalPages: Math.ceil(result.total / 12),
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    date?: string;
    dates?: string[];
    trips: TripInput[];
    note?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { trips } = body;
  const rawDates = body.dates ?? (body.date ? [body.date] : []);
  const note =
    typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";

  // Basic input validation
  if (!Array.isArray(rawDates) || rawDates.length === 0) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  const dates = Array.from(new Set(rawDates)).slice(0, 7);
  for (const d of dates) {
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d) || !isDateInWindow(d)) {
      return NextResponse.json(
        { error: `Invalid or out-of-window date: ${d}` },
        { status: 400 },
      );
    }
  }
  if (!Array.isArray(trips) || trips.length === 0 || trips.length > 10) {
    return NextResponse.json({ error: "Invalid trips" }, { status: 400 });
  }

  for (const trip of trips) {
    if (!Number.isFinite(trip.priceEgp) || trip.priceEgp < 0) {
      return NextResponse.json(
        { error: "Invalid trip priceEgp" },
        { status: 400 },
      );
    }
  }

  const vehiclesMap = await getVehicles();
  const allowedVehicleSet = new Set(Object.keys(vehiclesMap));

  await connectDB();
  const stationDocs = await Station.find({ active: true }).lean();
  const canonicalStations: GeoStation[] = stationDocs.map((station) => ({
    id: station.objectId,
    name: station.name || station.direction || "",
    direction: station.direction,
    stationType: station.stationType ?? "",
    lat: station.lat,
    lng: station.lng,
    popupInfo: [station.direction, station.landmark, station.stationType]
      .filter(Boolean)
      .join("\n"),
  }));

  interface ServerTrip {
    pickup: { address: string; lat: number; lng: number };
    dropoff: { address: string; lat: number; lng: number };
    vehicleType: string;
    rideType: string;
    arrivalTime: string;
    pickupTime: string;
    distanceKm: number;
    durationMinutes: number;
    priceEgp: number;
    extraPassengers: number;
    numberOfPassengers: number;
    stops: StopInput[];
    passengers: {
      sameAsMain: boolean;
      pickup: { address: string; lat: number; lng: number } | null;
      dropoff: { address: string; lat: number; lng: number } | null;
    }[];
    pickupStation?: { id: number; lat: number; lng: number; name: string };
    dropoffStation?: { id: number; lat: number; lng: number; name: string };
    pickupStationOptions?: StationOption[];
    dropoffStationOptions?: StationOption[];
    walkingMinToStation?: number;
    walkingMinFromStation?: number;
  }

  const serverTrips: ServerTrip[] = [];
  for (const t of trips) {
    // Validate required fields
    if (!t.pickup?.address || !t.dropoff?.address) {
      return NextResponse.json(
        { error: "Missing pickup/dropoff" },
        { status: 400 },
      );
    }
    if (!allowedVehicleSet.has(t.vehicleType)) {
      return NextResponse.json(
        { error: "Invalid vehicleType" },
        { status: 400 },
      );
    }
    const vKey = t.vehicleType as keyof typeof VEHICLES;
    const vehicle = vehiclesMap[vKey];
    const tripRideType = PRIVATE_VEHICLE_KEYS.has(vKey as VehicleKey)
      ? "private"
      : "shared";

    if (tripRideType === "private") {
      if (!t.pickupTime || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(t.pickupTime)) {
        return NextResponse.json(
          { error: "Invalid pickupTime" },
          { status: 400 },
        );
      }

      const numberOfPassengers = Number(t.numberOfPassengers);
      if (
        !Number.isInteger(numberOfPassengers) ||
        numberOfPassengers < 1 ||
        numberOfPassengers > vehicle.occupancy
      ) {
        return NextResponse.json(
          { error: "Invalid numberOfPassengers" },
          { status: 400 },
        );
      }

      if (!Array.isArray(t.stops) || t.stops.length > 4) {
        return NextResponse.json({ error: "Invalid stops" }, { status: 400 });
      }

      const stops: StopInput[] = [];
      let onboard = numberOfPassengers;
      for (const stop of t.stops) {
        if (
          !stop.point?.address ||
          !Number.isFinite(stop.point.lat) ||
          !Number.isFinite(stop.point.lng) ||
          !Number.isInteger(stop.alighting) ||
          !Number.isInteger(stop.boarding) ||
          !Number.isInteger(stop.waitingMinutes) ||
          stop.alighting < 0 ||
          stop.boarding < 0 ||
          stop.waitingMinutes < 0
        ) {
          return NextResponse.json({ error: "Invalid stop" }, { status: 400 });
        }
        if (stop.alighting > onboard - 1) {
          return NextResponse.json(
            { error: "At least one passenger must remain onboard" },
            { status: 400 },
          );
        }
        const afterAlighting = onboard - stop.alighting;
        if (stop.boarding > vehicle.occupancy - afterAlighting) {
          return NextResponse.json(
            { error: "Vehicle occupancy exceeded" },
            { status: 400 },
          );
        }
        onboard = afterAlighting + stop.boarding;
        stops.push({
          point: {
            address: stop.point.address,
            lat: stop.point.lat,
            lng: stop.point.lng,
          },
          alighting: stop.alighting,
          boarding: stop.boarding,
          waitingMinutes: stop.waitingMinutes,
        });
      }

      const distinctPassengers = (t.passengers ?? []).filter(
        (passenger) =>
          !passenger.sameAsMain && passenger.pickup && passenger.dropoff,
      );
      if (stops.length > 0 && distinctPassengers.length > 0) {
        return NextResponse.json(
          { error: "Stop points cannot be combined with passenger detours" },
          { status: 400 },
        );
      }
      const serverPassengers = (t.passengers ?? []).map((passenger) =>
        passenger.sameAsMain || !passenger.pickup || !passenger.dropoff
          ? { sameAsMain: true, pickup: null, dropoff: null }
          : {
              sameAsMain: false,
              pickup: passenger.pickup,
              dropoff: passenger.dropoff,
            },
      );

      if (!Number.isFinite(t.distanceKm) || t.distanceKm < 0) {
        return NextResponse.json(
          { error: "Invalid trip distanceKm" },
          { status: 400 },
        );
      }
      if (!Number.isFinite(t.durationMinutes) || t.durationMinutes < 0) {
        return NextResponse.json(
          { error: "Invalid trip durationMinutes" },
          { status: 400 },
        );
      }
      const pickupTime = t.pickupTime;
      if (!pickupTime || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(pickupTime)) {
        return NextResponse.json(
          { error: "Invalid pickupTime" },
          { status: 400 },
        );
      }
      const arrivalTime = t.arrivalTime;
      if (!arrivalTime || !/^\d{2}:\d{2}$/.test(arrivalTime)) {
        return NextResponse.json(
          { error: "Invalid arrivalTime" },
          { status: 400 },
        );
      }
      const priceEgp = computeTripPriceEgp({
        distanceKm: Number(t.distanceKm),
        vehicleType: vKey,
        extraPassengers: 0,
        numberOfPassengers,
        vehiclesMap,
      });

      // Nearest stations attached for admin/export use only — never shown to
      // the user, never affects route/duration/price.
      const nearPickup = findNearestStation(
        t.pickup.lat,
        t.pickup.lng,
        canonicalStations,
        vKey,
      );
      const nearDropoff = findNearestStation(
        t.dropoff.lat,
        t.dropoff.lng,
        canonicalStations,
        vKey,
      );

      serverTrips.push({
        pickup: t.pickup,
        dropoff: t.dropoff,
        vehicleType: vKey,
        rideType: tripRideType,
        arrivalTime,
        pickupTime,
        distanceKm: Number(t.distanceKm),
        durationMinutes: Math.round(Number(t.durationMinutes)),
        priceEgp,
        extraPassengers: 0,
        numberOfPassengers,
        stops,
        passengers: serverPassengers,
        ...(nearPickup && {
          pickupStation: stationPayload(nearPickup),
        }),
        ...(nearDropoff && {
          dropoffStation: stationPayload(nearDropoff),
        }),
      });
      continue;
    }

    if (!t.arrivalTime || !/^\d{2}:\d{2}$/.test(t.arrivalTime)) {
      return NextResponse.json(
        { error: "Invalid arrivalTime" },
        { status: 400 },
      );
    }
    if (
      !Number.isInteger(t.pickupStation?.id) ||
      !Number.isInteger(t.dropoffStation?.id)
    ) {
      return NextResponse.json(
        { error: "Invalid station selection" },
        { status: 400 },
      );
    }

    const pickupStationOptions = findNearestStations(
      t.pickup.lat,
      t.pickup.lng,
      canonicalStations,
      vKey,
    );
    const dropoffStationOptions = findNearestStations(
      t.dropoff.lat,
      t.dropoff.lng,
      canonicalStations,
      vKey,
    );
    const selectedPickup = pickupStationOptions.find(
      (station) => station.id === t.pickupStation!.id,
    );
    const selectedDropoff = dropoffStationOptions.find(
      (station) => station.id === t.dropoffStation!.id,
    );
    if (!selectedPickup || !selectedDropoff) {
      return NextResponse.json(
        { error: "Invalid station selection" },
        { status: 400 },
      );
    }

    if (!Number.isFinite(t.distanceKm) || t.distanceKm < 0) {
      return NextResponse.json(
        { error: "Invalid trip distanceKm" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(t.durationMinutes) || t.durationMinutes < 0) {
      return NextResponse.json(
        { error: "Invalid trip durationMinutes" },
        { status: 400 },
      );
    }
    const pickupTime = t.pickupTime;
    if (!pickupTime || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(pickupTime)) {
      return NextResponse.json(
        { error: "Invalid pickupTime" },
        { status: 400 },
      );
    }
    const arrivalTime = t.arrivalTime;
    if (!arrivalTime || !/^\d{2}:\d{2}$/.test(arrivalTime)) {
      return NextResponse.json(
        { error: "Invalid arrivalTime" },
        { status: 400 },
      );
    }
    const priceEgp = computeTripPriceEgp({
      distanceKm: Number(t.distanceKm),
      vehicleType: vKey,
      extraPassengers: Math.max(0, Math.round(Number(t.extraPassengers ?? 0))),
      vehiclesMap,
    });
    const extraPassengers = Math.max(
      0,
      Math.round(Number(t.extraPassengers ?? 0)),
    );

    serverTrips.push({
      pickup: {
        address: t.pickup.address,
        lat: t.pickup.lat,
        lng: t.pickup.lng,
      },
      dropoff: {
        address: t.dropoff.address,
        lat: t.dropoff.lat,
        lng: t.dropoff.lng,
      },
      vehicleType: vKey,
      rideType: tripRideType,
      arrivalTime,
      pickupTime,
      distanceKm: Number(t.distanceKm),
      durationMinutes: Math.round(Number(t.durationMinutes)),
      priceEgp,
      extraPassengers,
      numberOfPassengers: 1,
      stops: [],
      passengers: [],
      pickupStation: stationPayload(selectedPickup),
      dropoffStation: stationPayload(selectedDropoff),
      pickupStationOptions,
      dropoffStationOptions,
      walkingMinToStation: selectedPickup.walkingMin,
      walkingMinFromStation: selectedDropoff.walkingMin,
    });
  }

  const perDateAmountEgp = serverTrips.reduce((sum, t) => sum + t.priceEgp, 0);
  const amountEgp = perDateAmountEgp * dates.length;

  const request = await Request.create({
    userId: new Types.ObjectId(session.userId),
    dates,
    amountEgp,
    note,
    paymentStatus: "pending",
    status: "pending_payment",
  });

  try {
    const tripDocuments = await Promise.all(
      dates.flatMap((date) =>
        serverTrips.map(async (trip, cycleIndex) => ({
          tripNumber: await nextSequence("tripNumber"),
          requestId: request._id,
          userId: new Types.ObjectId(session.userId),
          date,
          cycleIndex,
          ...trip,
          paymentStatus: "pending",
          status: "pending_payment",
        })),
      ),
    );
    await Trip.insertMany(tripDocuments);
  } catch (err) {
    await Request.deleteOne({ _id: request._id });
    console.error("Trip fan-out failed — request rolled back:", err);
    return NextResponse.json(
      { error: "Failed to create trips" },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { bookingId: String(request._id), amountEgp },
    { status: 201 },
  );
}
