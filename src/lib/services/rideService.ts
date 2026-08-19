import mongoose, { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Ride, type RideDoc } from "../../models/Ride";
import { Trip, type TripDoc } from "../../models/Trip";
import { Availability, type AvailabilityDoc } from "../../models/Availability";
import type { RideDetailView, RideListRow, RideStatus } from "@/types/booking";
import type { GeoPoint, StationSelection } from "@/types/geo";
import {
  getSharedRouteStopCounts,
  normalizeSharedRidePassengers,
} from "@/lib/services/sharedRideManifest";

type MatchResult = {
  availabilityId: Types.ObjectId | string;
  driverId: Types.ObjectId | string;
  date: string;
  vehicleType: string;
  rideType: string;
  startTime: string;
  endTime: string;
  passengers: Array<{
    tripId: Types.ObjectId | string;
    userId?: Types.ObjectId | string;
    pickup: any;
    dropoff: any;
    pickupOrder: number;
    dropoffOrder: number;
    numberOfPassengers: number;
    tripCost: number;
    priceEgp?: number;
    seatNumbers?: number[];
  }>;
  totalCost?: number;
  status?: string;
  seatsRemaining?: number;
  route?: any[]; // StopSchema-compatible array optional; if absent will be calculated
};

function normalizeRoutePayload(route: any[] = []): any[] {
  return route.map((stop) => {
    if (!stop || typeof stop !== "object") return stop;
    const boardingValue = stop.boarding ?? stop.boardingNumber ?? 0;
    const alightingValue = stop.alighting ?? stop.alightingNumber ?? 0;
    return {
      ...stop,
      boardingNumber: Array.isArray(boardingValue)
        ? boardingValue.length
        : Number.isFinite(Number(boardingValue))
          ? Number(boardingValue)
          : 0,
      alightingNumber: Array.isArray(alightingValue)
        ? alightingValue.length
        : Number.isFinite(Number(alightingValue))
          ? Number(alightingValue)
          : 0,
      boarding: Array.isArray(stop.boarding) ? stop.boarding : [],
      alighting: Array.isArray(stop.alighting) ? stop.alighting : [],
      waitingMinutes: Number(stop.waitingMinutes ?? 0) || 0,
    };
  });
}

async function createRide(matchResult: MatchResult) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const availability = await Availability.findById(
      matchResult.availabilityId,
    ).session(session);
    if (!availability) throw new Error("Availability not found");

    const tripIds = matchResult.passengers.map((p) => p.tripId);
    const trips = await Trip.find({ _id: { $in: tripIds } })
      .select("pickupStation dropoffStation")
      .session(session)
      .lean<
        {
          _id: unknown;
          pickupStation?: StationSelection;
          dropoffStation?: StationSelection;
        }[]
      >();
    const tripById = new Map(trips.map((trip) => [String(trip._id), trip]));

    let currentSeatCounter = 1;
    const passengersForRide = matchResult.passengers.map((p) => {
      const trip = tripById.get(String(p.tripId));
      let seats = p.seatNumbers;
      const count = p.numberOfPassengers || 1;
      if (!Array.isArray(seats) || seats.length === 0) {
        seats = Array.from({ length: count }, (_, i) => currentSeatCounter + i);
        currentSeatCounter += count;
      } else {
        currentSeatCounter = Math.max(currentSeatCounter, Math.max(...seats) + 1);
      }
      return {
        tripId: p.tripId,
        userId: p.userId || null,
        pickup: p.pickup,
        dropoff: p.dropoff,
        pickupOrder: p.pickupOrder,
        dropoffOrder: p.dropoffOrder,
        tripCost: p.priceEgp || 0,
        numberOfPassengers: count,
        pickupStation: trip?.pickupStation ?? undefined,
        dropoffStation: trip?.dropoffStation ?? undefined,
        seatNumbers: seats,
        status: "waiting",
      };
    });

    const firstTrip = tripById.get(String(matchResult.passengers[0]?.tripId));
    const rideNumber = await getNextSequence("rideNumber", session);
    const rideDoc = new Ride({
      rideNumber,
      availabilityId: matchResult.availabilityId,
      driverId: matchResult.driverId,
      date: matchResult.date,
      vehicleType: matchResult.vehicleType,
      rideType: matchResult.rideType,
      startTime: matchResult.startTime,
      endTime: matchResult.endTime,
      passengers: passengersForRide,
      status: matchResult.status || "matched",
      totalCost: passengersForRide.reduce(
        (sum, p) => sum + (p.tripCost || 0),
        0,
      ),
      route: normalizeRoutePayload(matchResult.route || []),
      ...(matchResult.rideType === "shared"
        ? {
            pickupStation: firstTrip?.pickupStation ?? undefined,
            dropoffStation: firstTrip?.dropoffStation ?? undefined,
          }
        : {}),
    });

    // if route absent, compute basic route from passengers
    if (!matchResult.route) {
      rideDoc.route = normalizeRoutePayload(
        recalculateRouteFromPassengers(passengersForRide),
      );
    }

    await rideDoc.save({ session });

    // update availability (no seatsRemaining tracking for now)
    availability.rideId = rideDoc._id;
    availability.status = "matched";
    await availability.save({ session });

    // update trips with seatNumbers and driver assignment
    for (const p of matchResult.passengers) {
      const assigned = passengersForRide.find(
        (pr) => String(pr.tripId) === String(p.tripId),
      );
      await Trip.findByIdAndUpdate(
        p.tripId,
        {
          $set: {
            rideId: rideDoc._id,
            status: "matched",
            driverId: matchResult.driverId,
            seatNumbers: assigned?.seatNumbers ?? [],
          },
        },
        { session },
      );
    }

    await session.commitTransaction();
    session.endSession();
    return rideDoc;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

async function getNextSequence(name: string, session: mongoose.ClientSession) {
  const coll: any = mongoose.connection.collection("counters");
  const maxRide = await Ride.findOne({}, { rideNumber: 1 })
    .sort({ rideNumber: -1 })
    .session(session)
    .lean<{ rideNumber?: number }>();
  const maxSeq = maxRide?.rideNumber ?? 0;

  const res: any = await coll.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true, session },
  );

  const doc = res?.value ?? res;
  let nextSeq = doc?.seq ?? 1;
  if (nextSeq <= maxSeq) {
    nextSeq = maxSeq + 1;
    await coll.updateOne({ _id: name }, { $set: { seq: nextSeq } }, { session });
  }
  return nextSeq;
}

function recalculateRouteFromPassengers(passengers: any[]) {
  // Build stops array by order indices. Aggregate boarding/alighting counts per order.
  const indexMap: Record<number, any> = {};
  let maxIndex = 0;
  for (const p of passengers) {
    const b = p.pickupOrder;
    const a = p.dropoffOrder;
    maxIndex = Math.max(maxIndex, b, a);

    const pickupPoint = p.pickupStation
      ? {
          lat: p.pickupStation.lat,
          lng: p.pickupStation.lng,
          address: p.pickupStation.name ?? p.pickupStation.address ?? "Pickup station",
        }
      : p.pickup;

    const dropoffPoint = p.dropoffStation
      ? {
          lat: p.dropoffStation.lat,
          lng: p.dropoffStation.lng,
          address: p.dropoffStation.name ?? p.dropoffStation.address ?? "Dropoff station",
        }
      : p.dropoff;

    if (!indexMap[b])
      indexMap[b] = {
        point: pickupPoint,
        boarding: 0,
        alighting: 0,
        waitingMinutes: 0,
      };
    if (!indexMap[a])
      indexMap[a] = {
        point: dropoffPoint,
        boarding: 0,
        alighting: 0,
        waitingMinutes: 0,
      };
    indexMap[b].boarding += p.numberOfPassengers || 1;
    indexMap[a].alighting += p.numberOfPassengers || 1;
  }
  const stops = [];
  for (let i = 0; i <= maxIndex; i++) {
    if (indexMap[i]) {
      const boardingCount = indexMap[i].boarding || 0;
      const alightingCount = indexMap[i].alighting || 0;
      stops.push({
        point: indexMap[i].point,
        boardingNumber: boardingCount,
        alightingNumber: alightingCount,
        boarding: [],
        alighting: [],
        waitingMinutes: indexMap[i].waitingMinutes || 0,
      });
    }
  }
  return stops;
}

function toGeoPoint(
  raw: Record<string, unknown> | null | undefined,
): GeoPoint | null {
  if (
    !raw ||
    typeof raw.lat !== "number" ||
    typeof raw.lng !== "number" ||
    Number.isNaN(raw.lat) ||
    Number.isNaN(raw.lng)
  ) {
    return null;
  }
  return {
    lat: raw.lat,
    lng: raw.lng,
    address: typeof raw.address === "string" ? raw.address : "—",
  };
}

function toStation(
  raw: Record<string, unknown> | null | undefined,
): StationSelection | null {
  if (
    !raw ||
    typeof raw.id !== "number" ||
    typeof raw.lat !== "number" ||
    typeof raw.lng !== "number" ||
    Number.isNaN(raw.lat) ||
    Number.isNaN(raw.lng)
  ) {
    return null;
  }
  return {
    id: raw.id,
    lat: raw.lat,
    lng: raw.lng,
    name: typeof raw.name === "string" ? raw.name : "—",
    stationType:
      typeof raw.stationType === "string" ? raw.stationType : "station",
    direction: typeof raw.direction === "string" ? raw.direction : undefined,
    landmark: typeof raw.landmark === "string" ? raw.landmark : undefined,
  };
}

function getRidePassengers(
  ride: Record<string, unknown>,
): Record<string, unknown>[] {
  return normalizeSharedRidePassengers(ride);
}

function mapPassengerRow(p: Record<string, any>, index = 0, array: Record<string, any>[] = []) {
  let seatNumbers: number[] = Array.isArray(p.seatNumbers) && p.seatNumbers.length > 0 ? p.seatNumbers : [];
  if (seatNumbers.length === 0) {
    let startSeat = 1;
    for (let i = 0; i < index; i++) {
      startSeat += array[i]?.numberOfPassengers || 1;
    }
    const count = p.numberOfPassengers || 1;
    seatNumbers = Array.from({ length: count }, (_, i) => startSeat + i);
  }

  return {
    tripId: String(p.tripId),
    pickupAddress: p.pickup?.address ?? "—",
    dropoffAddress: p.dropoff?.address ?? "—",
    pickupOrder: p.pickupOrder ?? 0,
    dropoffOrder: p.dropoffOrder ?? 0,
    numberOfPassengers: p.numberOfPassengers ?? 1,
    tripCost: p.tripCost ?? 0,
    status: p.status ?? "waiting",
    pickupStation: toStation(p.pickupStation),
    dropoffStation: toStation(p.dropoffStation),
    seatNumbers,
    passengerName: p.passengerName ?? `Passenger #${p.pickupOrder ?? index + 1}`,
  };
}

function mapRideToDetailView(ride: Record<string, any>): RideDetailView {
  const ridePassengers = getRidePassengers(ride);
  const passengers = ridePassengers.map((p: Record<string, any>, i: number, arr: Record<string, any>[]) => ({
    ...mapPassengerRow(p, i, arr),
    pickup: toGeoPoint(p.pickup),
    dropoff: toGeoPoint(p.dropoff),
  }));

  return {
    id: String(ride._id),
    rideNumber: ride.rideNumber,
    date: ride.date,
    status: ride.status as RideStatus,
    vehicleType: ride.vehicleType,
    rideType: ride.rideType,
    startTime: ride.startTime,
    endTime: ride.endTime,
    totalCost: ride.totalCost ?? 0,
    passengerCount: passengers.reduce(
      (sum: number, p: { numberOfPassengers: number }) =>
        sum + (p.numberOfPassengers || 1),
      0,
    ),
    passengers,
    route: (ride.route ?? []).map((stop: Record<string, any>) => {
      const counts = getSharedRouteStopCounts(stop);
      return {
        address: stop.point?.address ?? "—",
        point: toGeoPoint(stop.point),
        boarding: counts.boarding,
        alighting: counts.alighting,
        waitingMinutes: stop.waitingMinutes ?? 0,
      };
    }),
    pickupStation: toStation(ride.pickupStation),
    dropoffStation: toStation(ride.dropoffStation),
    driverOrigin: toGeoPoint(ride.driverOrigin),
    driverDestination: toGeoPoint(ride.driverDestination),
    chatTripId: passengers[0]?.tripId ?? null,
    createdAt:
      ride.createdAt instanceof Date
        ? ride.createdAt.toISOString()
        : String(ride.createdAt ?? new Date().toISOString()),
  };
}

async function getDriverRide(
  driverId: string | Types.ObjectId,
  id: string,
): Promise<RideDetailView | null> {
  if (!Types.ObjectId.isValid(id)) return null;

  await connectDB();
  const driverOid = new Types.ObjectId(String(driverId));
  const lookupId = new Types.ObjectId(id);

  let ride = await Ride.findOne({ _id: lookupId, driverId: driverOid }).lean();
  if (!ride) {
    ride = await Ride.findOne({
      driverId: driverOid,
      $or: [
        { "passengers.tripId": lookupId },
        { "route.boarding.tripId": lookupId },
        { "route.alighting.tripId": lookupId },
      ],
    }).lean();
  }

  if (!ride) return null;

  const { User } = await import("@/models/User");
  const { Station } = await import("@/models/Station");

  const ridePassengers = getRidePassengers(ride as Record<string, any>);
  const userIds = ridePassengers
    .map((p: any) => p.userId)
    .filter(Boolean);
  const users = await User.find({ _id: { $in: userIds } })
    .select("name phone")
    .lean<{ _id: unknown; name?: string; phone?: string }[]>();
  const userById = new Map(users.map((u) => [String(u._id), u]));

  // Look up station details from Station collection
  const stationIds: number[] = [];
  if (ride.pickupStation?.id) stationIds.push(ride.pickupStation.id);
  if (ride.dropoffStation?.id) stationIds.push(ride.dropoffStation.id);
  for (const p of ridePassengers) {
    const passengerStations = p as {
      pickupStation?: { id?: number };
      dropoffStation?: { id?: number };
    };
    if (passengerStations.pickupStation?.id) {
      stationIds.push(passengerStations.pickupStation.id);
    }
    if (passengerStations.dropoffStation?.id) {
      stationIds.push(passengerStations.dropoffStation.id);
    }
  }

  const stationDocs = stationIds.length > 0
    ? await Station.find({ objectId: { $in: stationIds } }).lean<any[]>()
    : [];
  const stationById = new Map(stationDocs.map((s) => [s.objectId, s]));

  const enrichStation = (st: any) => {
    if (!st) return st;
    const doc = stationById.get(st.id);
    if (!doc) return st;
    return {
      ...st,
      direction: st.direction || doc.direction,
      landmark: st.landmark || doc.landmark,
      stationType: st.stationType || doc.stationType,
      name: st.name || doc.name,
    };
  };

  const rideWithUserNames = {
    ...ride,
    pickupStation: enrichStation(ride.pickupStation),
    dropoffStation: enrichStation(ride.dropoffStation),
    passengers: ridePassengers.map((p: any) => ({
      ...p,
      pickupStation: enrichStation(p.pickupStation),
      dropoffStation: enrichStation(p.dropoffStation),
      passengerName: userById.get(String(p.userId))?.name ?? `Passenger #${p.pickupOrder}`,
    })),
  };

  return mapRideToDetailView(rideWithUserNames as Record<string, any>);
}

async function getRideById(rideId: string): Promise<RideDetailView | null> {
  if (!Types.ObjectId.isValid(rideId)) return null;
  await connectDB();
  const ride = await Ride.findById(rideId).lean();
  if (!ride) return null;
  return mapRideToDetailView(ride as Record<string, any>);
}

async function getRideByNumber(rideNumber: number) {
  return Ride.findOne({ rideNumber }).lean();
}

const RIDE_STATUS_GROUPS: Record<string, RideStatus[]> = {
  pending_payment: ["pending_payment" as RideStatus],
  ongoing: ["matched", "confirmed", "active"],
  previous: ["completed", "cancelled"],
};

export interface ListDriverRidesOptions {
  page?: number;
  pageSize?: number;
  statusGroup?: "pending_payment" | "ongoing" | "previous";
  date?: string;
  dateFrom?: string;
  dateTo?: string;
}

function mapRideToListRow(ride: Record<string, any>): RideListRow {
  const ridePassengers = getRidePassengers(ride);
  const passengers = ridePassengers.map((p: Record<string, any>, index: number) =>
    mapPassengerRow(p, index, ridePassengers),
  );

  return {
    id: String(ride._id),
    rideNumber: ride.rideNumber,
    date: ride.date,
    status: ride.status as RideStatus,
    vehicleType: ride.vehicleType,
    rideType: ride.rideType,
    startTime: ride.startTime,
    endTime: ride.endTime,
    totalCost: ride.totalCost ?? 0,
    passengerCount: passengers.reduce(
      (sum: number, p: { numberOfPassengers: number }) =>
        sum + (p.numberOfPassengers || 1),
      0,
    ),
    passengers,
    route: (ride.route ?? []).map((stop: Record<string, any>) => {
      const counts = getSharedRouteStopCounts(stop);
      return {
        address: stop.point?.address ?? "—",
        boarding: counts.boarding,
        alighting: counts.alighting,
        waitingMinutes: stop.waitingMinutes ?? 0,
      };
    }),
    pickupStation: toStation(ride.pickupStation),
    dropoffStation: toStation(ride.dropoffStation),
    createdAt:
      ride.createdAt instanceof Date
        ? ride.createdAt.toISOString()
        : String(ride.createdAt ?? new Date().toISOString()),
  };
}

async function getRidesByDriver(
  driverId: string | Types.ObjectId,
  options?: string | ListDriverRidesOptions,
): Promise<
  RideListRow[] | { rows: RideListRow[]; total: number; page: number }
> {
  await connectDB();

  const opts: ListDriverRidesOptions =
    typeof options === "string" ? { date: options } : (options ?? {});

  const { page, pageSize = 12, statusGroup, date, dateFrom, dateTo } = opts;

  const q: Record<string, unknown> = {
    driverId: new Types.ObjectId(String(driverId)),
  };

  if (statusGroup && RIDE_STATUS_GROUPS[statusGroup]) {
    q.status = { $in: RIDE_STATUS_GROUPS[statusGroup] };
  }
  if (date) {
    q.date = date;
  } else if (dateFrom || dateTo) {
    const dateCond: Record<string, string> = {};
    if (dateFrom) dateCond.$gte = dateFrom;
    dateCond.$lte = dateTo || dateFrom!;
    q.date = dateCond;
  }

  const query = Ride.find(q).sort({ date: -1, startTime: 1 });

  if (page) {
    const [total, rides] = await Promise.all([
      Ride.countDocuments(q),
      query
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);

    return {
      total,
      page,
      rows: rides.map((ride) => mapRideToListRow(ride as Record<string, any>)),
    };
  }

  const rides = await query.lean();
  return rides.map((ride) => mapRideToListRow(ride as Record<string, any>));
}

async function getActiveRideForDriver(driverId: string | Types.ObjectId) {
  return Ride.findOne({
    driverId,
    status: { $in: ["matched", "confirmed", "active"] },
  }).lean();
}

async function getRideByAvailability(availabilityId: string | Types.ObjectId) {
  return Ride.findOne({ availabilityId }).lean();
}

async function updateRideStatus(
  rideId: string | Types.ObjectId,
  status: string,
) {
  return Ride.findByIdAndUpdate(
    rideId,
    { $set: { status } },
    { returnDocument: "after" },
  );
}

async function updatePassengerStatusInRide(
  rideId: string | Types.ObjectId,
  tripId: string | Types.ObjectId,
  status: string,
) {
  const res = await Ride.findOneAndUpdate(
    { _id: rideId, "passengers.tripId": tripId },
    { $set: { "passengers.$.status": status } },
    { returnDocument: "after" },
  );
  return res;
}

async function addPassengerToRide(
  rideId: string | Types.ObjectId,
  passenger: any,
) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const ride = await Ride.findById(rideId).session(session);
    if (!ride) throw new Error("Ride not found");
    const availability = await Availability.findById(
      ride.availabilityId,
    ).session(session);
    if (!availability) throw new Error("Availability not found");
    // no seatsRemaining checks for now

    const trip = await Trip.findById(passenger.tripId)
      .select("pickupStation dropoffStation")
      .session(session)
      .lean<{
        pickupStation?: StationSelection;
        dropoffStation?: StationSelection;
      }>();

    ride.passengers.push({
      tripId: passenger.tripId,
      userId: passenger.userId || null,
      pickup: passenger.pickup,
      dropoff: passenger.dropoff,
      pickupOrder: passenger.pickupOrder,
      dropoffOrder: passenger.dropoffOrder,
      numberOfPassengers: passenger.numberOfPassengers || 1,
      pickupStation: trip?.pickupStation ?? undefined,
      dropoffStation: trip?.dropoffStation ?? undefined,
      status: "waiting",
    });

    // recompute route
    ride.route = recalculateRouteFromPassengers(ride.passengers as any[]);

    // do not modify seatsRemaining; keep availability marked matched
    availability.status = "matched";

    await Trip.findByIdAndUpdate(
      passenger.tripId,
      { $set: { rideId: ride._id, status: "matched" } },
      { session },
    );
    await ride.save({ session });
    await availability.save({ session });

    await session.commitTransaction();
    session.endSession();
    return ride;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

async function removePassengerFromRide(
  rideId: string | Types.ObjectId,
  tripId: string | Types.ObjectId,
  reason?: string,
) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const ride = await Ride.findById(rideId).session(session);
    if (!ride) throw new Error("Ride not found");
    const availability = await Availability.findById(
      ride.availabilityId,
    ).session(session);
    if (!availability) throw new Error("Availability not found");

    const passenger = ride.passengers.find(
      (p: any) => p.tripId?.toString() === tripId.toString(),
    );
    if (!passenger) throw new Error("Passenger not in ride");

    ride.passengers = ride.passengers.filter(
      (p: any) => p.tripId?.toString() !== tripId.toString(),
    );
    ride.route = recalculateRouteFromPassengers(ride.passengers as any[]);

    await Trip.findByIdAndUpdate(
      tripId,
      {
        $set: {
          rideId: null,
          status: "submitted",
          driverId: null,
          assignedDriver: null,
          seatNumbers: [],
        },
      },
      { session },
    );
    await ride.save({ session });
    await availability.save({ session });

    await session.commitTransaction();
    session.endSession();
    return ride;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

async function recalculateRoute(rideId: string | Types.ObjectId) {
  const ride = await Ride.findById(rideId);
  if (!ride) throw new Error("Ride not found");
  ride.route = recalculateRouteFromPassengers(ride.passengers as any[]);
  await ride.save();
  return ride;
}

async function getRideByPassengerIncluded(
  passengerId: string | Types.ObjectId,
) {
  // Match either a passenger's tripId or userId to be flexible about passed id
  const q: any = {
    $or: [
      { "passengers.tripId": passengerId },
      { "passengers.userId": passengerId },
    ],
  };
  return Ride.find(q).sort({ date: -1, startTime: 1 }).lean();
}

async function cancelRide(rideId: string | Types.ObjectId, reason?: string) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const ride = await Ride.findById(rideId).session(session);
    if (!ride) throw new Error("Ride not found");
    if (ride.status === "completed") {
      throw new Error("Completed rides cannot be deleted");
    }

    // set status
    ride.status = "cancelled" as any;
    await ride.save({ session });

    // unlink trips
    const tripIds = [...new Set([
      ...ride.passengers.map((passenger: any) => String(passenger.tripId)),
      ...ride.route.flatMap((stop: any) => [
        ...(Array.isArray(stop.boarding) ? stop.boarding : []),
        ...(Array.isArray(stop.alighting) ? stop.alighting : []),
      ]).map((passenger: any) => String(passenger.tripId)),
    ].filter((tripId) => Types.ObjectId.isValid(tripId)))];

    await Trip.updateMany(
      { _id: { $in: tripIds } },
      {
        $set: {
          rideId: null,
          status: "submitted",
          driverId: null,
          assignedDriver: null,
          seatNumbers: [],
        },
      },
      { session },
    );

    // release availability
    if (ride.availabilityId) {
      const availability = await Availability.findById(
        ride.availabilityId,
      ).session(session);
      if (availability) {
        availability.rideId = null;
        availability.status = "open";
        await availability.save({ session });
      }
    }

    await session.commitTransaction();
    session.endSession();
    return ride;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

export {
  createRide,
  getRideById,
  getDriverRide,
  getRideByNumber,
  getRidesByDriver,
  getRideByPassengerIncluded,
  getActiveRideForDriver,
  getRideByAvailability,
  updateRideStatus,
  updatePassengerStatusInRide,
  addPassengerToRide,
  removePassengerFromRide,
  recalculateRoute,
  cancelRide,
};
