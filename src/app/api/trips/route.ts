import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { nextSequence } from "@/models/Counter";
import { Station } from "@/models/Station";
import {
  VEHICLES,
  priceFor,
  maxExtraPassengers,
  finalPrice,
  privateRoutePrice,
  waitingCostEgp,
} from "@/lib/config/vehicles";
import { computeArrivalTime, computePickupTime } from "@/lib/time/pickupWindow";
import { isDateInWindow } from "@/lib/time/bookingDates";
import { getVehicles } from "@/lib/db/getVehicles";
import { fetchDirections } from "@/app/api/directions/route";
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

/** Fetch total distance/duration for an origin→...waypoints...→dest route directly from Google (no internal HTTP hop). */
async function fetchServerRoute(
  points: { lat: number; lng: number }[],
): Promise<{ distanceKm: number; durationMinutes: number } | null> {
  const origin = `${points[0].lat},${points[0].lng}`;
  const dest = `${points[points.length - 1].lat},${points[points.length - 1].lng}`;
  const mid = points.slice(1, -1);
  const waypoints = mid.length
    ? mid.map((p) => `${p.lat},${p.lng}`).join("|")
    : undefined;
  const data = await fetchDirections(origin, dest, waypoints);
  if (!data.length) return null;
  return {
    distanceKm: data[0].distance_km,
    durationMinutes: data[0].duration_minutes,
  };
}

function stationPayload(station: Pick<GeoStation, "id" | "lat" | "lng" | "name">) {
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
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1000) : "";

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
    const isShared = vehicle.ride === "shared";

    if (!isShared) {
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

      const privateRoutePoints = [
        t.pickup,
        ...stops.map((stop) => stop.point),
        t.dropoff,
      ];
      let route = await fetchServerRoute(privateRoutePoints);
      let fareLegs = [
        { distanceKm: route?.distanceKm ?? 0, passengers: numberOfPassengers },
      ];
      if (distinctPassengers.length > 0) {
        const baseRoute = await fetchServerRoute([t.pickup, t.dropoff]);
        const detourRoute = await fetchServerRoute([
          t.pickup,
          ...distinctPassengers.map((passenger) => passenger.pickup!),
          ...distinctPassengers.map((passenger) => passenger.dropoff!),
          t.dropoff,
        ]);
        if (!baseRoute || !detourRoute) {
          return NextResponse.json(
            { error: "Failed to compute passenger detour route." },
            { status: 502 },
          );
        }
        if (detourRoute.distanceKm > baseRoute.distanceKm * 1.25) {
          return NextResponse.json(
            { error: "Detour exceeds 25%" },
            { status: 400 },
          );
        }
        route = detourRoute;
        fareLegs = [
          {
            distanceKm: detourRoute.distanceKm,
            passengers: numberOfPassengers,
          },
        ];
      }
      if (!route) {
        return NextResponse.json(
          { error: "Failed to compute route" },
          { status: 502 },
        );
      }

      if (stops.length > 0) {
        const legRoutes = await Promise.all(
          privateRoutePoints
            .slice(0, -1)
            .map((point, index) =>
              fetchServerRoute([point, privateRoutePoints[index + 1]]),
            ),
        );
        if (legRoutes.some((legRoute) => !legRoute)) {
          return NextResponse.json(
            { error: "Failed to compute route" },
            { status: 502 },
          );
        }
        let passengers = numberOfPassengers;
        fareLegs = legRoutes.map((legRoute, index) => {
          const fareLeg = {
            distanceKm: legRoute!.distanceKm,
            passengers,
          };
          const stop = stops[index];
          if (stop) passengers += stop.boarding - stop.alighting;
          return fareLeg;
        });
      }

      const totalWaitingMinutes = stops.reduce(
        (total, stop) => total + stop.waitingMinutes,
        0,
      );
      const arrivalTime = computeArrivalTime(
        t.pickupTime,
        route.durationMinutes,
        totalWaitingMinutes,
        10,
      );
      const priceEgp =
        privateRoutePrice(fareLegs, vKey, vehiclesMap) +
        waitingCostEgp(totalWaitingMinutes, vKey, vehiclesMap);

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
        rideType: vehicle.ride,
        arrivalTime,
        pickupTime: t.pickupTime,
        distanceKm: route.distanceKm,
        durationMinutes: Math.round(route.durationMinutes),
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

    const route = await fetchServerRoute([selectedPickup, selectedDropoff]);
    if (!route) {
      return NextResponse.json(
        { error: "Failed to compute route" },
        { status: 502 },
      );
    }

    const pickupTime = computePickupTime(
      t.arrivalTime,
      Math.round(route.durationMinutes) + selectedDropoff.walkingMin,
      vKey,
      vehiclesMap,
    );
    const extraPax = Math.min(
      maxExtraPassengers(vKey),
      Math.max(0, Math.round(Number(t.extraPassengers ?? 0))),
    );
    const priceEgp = finalPrice(
      priceFor(route.distanceKm, vKey, vehiclesMap),
      extraPax,
      vKey,
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
      rideType: vehicle.ride,
      arrivalTime: t.arrivalTime,
      pickupTime,
      distanceKm: route.distanceKm,
      durationMinutes: Math.round(route.durationMinutes),
      priceEgp,
      extraPassengers: extraPax,
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
