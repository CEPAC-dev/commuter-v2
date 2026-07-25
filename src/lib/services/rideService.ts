import mongoose, { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Ride, type RideDoc } from "../../models/Ride";
import { Trip, type TripDoc } from "../../models/Trip";
import { Availability, type AvailabilityDoc } from "../../models/Availability";
import type {
  RideDetailView,
  RideListRow,
  RideStatus,
} from "@/types/booking";
import type { GeoPoint, StationSelection } from "@/types/geo";

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
  }>;
  totalCost?: number;
  status?: string;
  seatsRemaining?: number;
  route?: any[]; // StopSchema-compatible array optional; if absent will be calculated
};

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

    const passengersForRide = matchResult.passengers.map((p) => {
      const trip = tripById.get(String(p.tripId));
      return {
        tripId: p.tripId,
        userId: p.userId || null,
        pickup: p.pickup,
        dropoff: p.dropoff,
        pickupOrder: p.pickupOrder,
        dropoffOrder: p.dropoffOrder,
        tripCost: p.priceEgp || 0,
        numberOfPassengers: p.numberOfPassengers || 1,
        pickupStation: trip?.pickupStation ?? undefined,
        dropoffStation: trip?.dropoffStation ?? undefined,
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
      totalCost: passengersForRide.reduce(
        (sum, p) => sum + (p.tripCost || 0),
        0,
      ),
      route: matchResult.route || [],
      ...(matchResult.rideType === "shared"
        ? {
            pickupStation: firstTrip?.pickupStation ?? undefined,
            dropoffStation: firstTrip?.dropoffStation ?? undefined,
          }
        : {}),
    });

    // if route absent, compute basic route from passengers
    if (!matchResult.route) {
      rideDoc.route = recalculateRouteFromPassengers(passengersForRide);
    }

    await rideDoc.save({ session });

    // update availability (no seatsRemaining tracking for now)
    availability.rideId = rideDoc._id;
    availability.status = "matched";
    await availability.save({ session });

    // update trips
    for (const p of matchResult.passengers) {
      await Trip.findByIdAndUpdate(
        p.tripId,
        {
          $set: {
            rideId: rideDoc._id,
            status: "matched",
            driverId: matchResult.driverId,
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
  const res: any = await coll.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true, session },
  );
  return (res.value && (res.value.seq as number)) || 1;
}

function recalculateRouteFromPassengers(passengers: any[]) {
  // Build stops array by order indices. Aggregate boarding/alighting counts per order.
  const indexMap: Record<number, any> = {};
  let maxIndex = 0;
  for (const p of passengers) {
    const b = p.pickupOrder;
    const a = p.dropoffOrder;
    maxIndex = Math.max(maxIndex, b, a);
    if (!indexMap[b])
      indexMap[b] = {
        point: p.pickup,
        boarding: 0,
        alighting: 0,
        waitingMinutes: 0,
      };
    if (!indexMap[a])
      indexMap[a] = {
        point: p.dropoff,
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
      stops.push({
        point: indexMap[i].point,
        boarding: indexMap[i].boarding || 0,
        alighting: indexMap[i].alighting || 0,
        waitingMinutes: indexMap[i].waitingMinutes || 0,
      });
    }
  }
  return stops;
}

async function getRideById(id: string | Types.ObjectId) {
  await connectDB();
  return Ride.findById(id).lean();
}

function toGeoPoint(raw: Record<string, unknown> | null | undefined): GeoPoint | null {
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
  };
}

function mapPassengerRow(p: Record<string, any>) {
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
  };
}

function mapRideToDetailView(ride: Record<string, any>): RideDetailView {
  const passengers = (ride.passengers ?? []).map((p: Record<string, any>) => ({
    ...mapPassengerRow(p),
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
    route: (ride.route ?? []).map((stop: Record<string, any>) => ({
      address: stop.point?.address ?? "—",
      point: toGeoPoint(stop.point),
      boarding: stop.boarding ?? 0,
      alighting: stop.alighting ?? 0,
      waitingMinutes: stop.waitingMinutes ?? 0,
    })),
    pickupStation: toStation(ride.pickupStation),
    dropoffStation: toStation(ride.dropoffStation),
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
      "passengers.tripId": lookupId,
    }).lean();
  }

  if (!ride) return null;
  return mapRideToDetailView(ride as Record<string, any>);
}

async function getRideByNumber(rideNumber: number) {
  return Ride.findOne({ rideNumber }).lean();
}

const RIDE_STATUS_GROUPS: Record<string, RideStatus[]> = {
  ongoing: ["matched", "confirmed", "active"],
  previous: ["completed", "cancelled"],
};

export interface ListDriverRidesOptions {
  page?: number;
  pageSize?: number;
  statusGroup?: "ongoing" | "previous";
  date?: string;
  dateFrom?: string;
  dateTo?: string;
}

function mapRideToListRow(ride: Record<string, any>): RideListRow {
  const passengers = (ride.passengers ?? []).map((p: Record<string, any>) =>
    mapPassengerRow(p),
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
    route: (ride.route ?? []).map((stop: Record<string, any>) => ({
      address: stop.point?.address ?? "—",
      boarding: stop.boarding ?? 0,
      alighting: stop.alighting ?? 0,
      waitingMinutes: stop.waitingMinutes ?? 0,
    })),
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
): Promise<RideListRow[] | { rows: RideListRow[]; total: number; page: number }> {
  await connectDB();

  const opts: ListDriverRidesOptions =
    typeof options === "string" ? { date: options } : (options ?? {});

  const {
    page,
    pageSize = 12,
    statusGroup,
    date,
    dateFrom,
    dateTo,
  } = opts;

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
  return Ride.findByIdAndUpdate(rideId, { $set: { status } }, { new: true });
}

async function updatePassengerStatusInRide(
  rideId: string | Types.ObjectId,
  tripId: string | Types.ObjectId,
  status: string,
) {
  const res = await Ride.findOneAndUpdate(
    { _id: rideId, "passengers.tripId": tripId },
    { $set: { "passengers.$.status": status } },
    { new: true },
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
      { $set: { rideId: null, status: "submitted" } },
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

    // set status
    ride.status = "cancelled" as any;
    await ride.save({ session });

    // unlink trips
    const tripIds = ride.passengers.map((p: any) => p.tripId);
    const seats = ride.passengers.reduce(
      (s: number, p: any) => s + (p.numberOfPassengers || 1),
      0,
    );

    await Trip.updateMany(
      { _id: { $in: tripIds } },
      { $set: { rideId: null, status: "submitted" } },
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
