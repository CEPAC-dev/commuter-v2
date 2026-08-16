import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { Request as RequestModel } from "@/models/Request";
import { User } from "@/models/User";
import { Driver } from "@/models/Driver";
import { Rating } from "@/models/Rating";
import type {
  BookingStatus,
  PaymentStatus,
  RideDetailView,
  TripListRow,
} from "@/types/booking";
import type { GeoPoint, StationSelection } from "@/types/geo";

export interface StationOption extends StationSelection {
  distanceKm: number;
  walkingMin: number;
}

export interface AssignedDriver {
  name?: string;
  phone?: string;
  profilePic?: string;
  carBrand?: string;
  carModel?: string;
  modelYear?: string;
  plate?: string;
}

export interface DriverSummarySnapshot {
  name?: string;
  phone?: string;
  gender?: string;
  carBrand?: string;
  carModel?: string;
  carType?: string;
  modelYear?: string;
  vehicleColor?: string;
  carCapacity?: number;
  profilePicture?: string;
  carImage?: string;
  plateChar1?: string;
  plateChar2?: string;
  plateChar3?: string;
  plateDigits?: string;
}

export async function getDriverSummaryByUserNumber(
  userNumber: number | string,
): Promise<DriverSummarySnapshot | null> {
  await connectDB();

  const normalizedUserNumber = Number(userNumber);
  if (!Number.isFinite(normalizedUserNumber)) return null;

  const user = await User.findOne({ userNumber: normalizedUserNumber })
    .select("_id name phone profilePic")
    .lean<{
      _id?: unknown;
      name?: string;
      phone?: string;
      profilePic?: string;
    }>();

  if (!user?._id) return null;

  const driver = await Driver.findOne({ userId: user._id })
    .select(
      "gender carBrand carModel carType modelYear vehicleColor carCapacity documents plateChar1 plateChar2 plateChar3 plateDigits",
    )
    .lean<{
      gender?: string;
      carBrand?: string;
      carModel?: string;
      carType?: string;
      modelYear?: number;
      vehicleColor?: string;
      carCapacity?: number;
      documents?: { profilePic?: string; carImage?: string };
      plateChar1?: string;
      plateChar2?: string;
      plateChar3?: string;
      plateDigits?: string;
    }>();

  return {
    name: user.name,
    phone: user.phone,
    gender: driver?.gender,
    carBrand: driver?.carBrand,
    carModel: driver?.carModel,
    carType: driver?.carType,
    modelYear: driver?.modelYear ? String(driver.modelYear) : undefined,
    vehicleColor: driver?.vehicleColor,
    carCapacity: driver?.carCapacity,
    profilePicture: user.profilePic ?? driver?.documents?.profilePic,
    carImage: driver?.documents?.carImage,
    plateChar1: driver?.plateChar1,
    plateChar2: driver?.plateChar2,
    plateChar3: driver?.plateChar3,
    plateDigits: driver?.plateDigits,
  };
}

/**
 * Fetch assignedDriver data from User and Driver documents using driverId.
 * Combines user info (name, phone) with driver info (car details, documents).
 */
export async function buildAssignedDriver(
  driverId: unknown,
): Promise<AssignedDriver | null> {
  if (!driverId || !Types.ObjectId.isValid(String(driverId))) return null;

  const [user, driver] = await Promise.all([
    User.findById(driverId)
      .select("name phone")
      .lean<{ name?: string; phone?: string }>(),
    Driver.findOne({ userId: driverId })
      .select(
        "carBrand carModel modelYear plateChar1 plateChar2 plateChar3 plateDigits documents",
      )
      .lean<{
        carBrand?: string;
        carModel?: string;
        modelYear?: number;
        plateChar1?: string;
        plateChar2?: string;
        plateChar3?: string;
        plateDigits?: string;
        documents?: { profilePic?: string };
      }>(),
  ]);

  if (!user) return null;

  const plate =
    driver &&
    driver.plateChar1 &&
    driver.plateChar2 &&
    driver.plateChar3 &&
    driver.plateDigits
      ? `${driver.plateChar1} ${driver.plateChar2} ${driver.plateChar3} ${driver.plateDigits}`
      : undefined;

  return {
    name: user.name,
    phone: user.phone,
    profilePic: driver?.documents?.profilePic,
    carBrand: driver?.carBrand,
    carModel: driver?.carModel,
    modelYear: driver?.modelYear ? String(driver.modelYear) : undefined,
    plate,
  };
}

export interface StationOption extends StationSelection {
  distanceKm: number;
  walkingMin: number;
}

const STATUS_GROUPS: Record<string, BookingStatus[]> = {
  pending_payment: ["pending_payment"],
  upcoming: ["submitted", "confirmed"],
  ongoing: ["active", "matched"],
  previous: ["completed", "cancelled", "time_out"],
};

export interface ListUserTripsOptions {
  page: number;
  pageSize?: number;
  paymentStatus?: PaymentStatus;
  vehicleType?: string;
  statusGroup?: "previous" | "ongoing" | "upcoming" | "pending_payment";
  dateFrom?: string;
  dateTo?: string;
}

export async function listDriverTrips(
  driverId: string,
  options: ListUserTripsOptions,
): Promise<{ rows: TripListRow[]; total: number; page: number }> {
  await connectDB();

  const {
    page,
    pageSize = 12,
    paymentStatus,
    vehicleType,
    statusGroup,
    dateFrom,
    dateTo,
  } = options;

  const tripMatch: Record<string, unknown> = {
    driverId: new Types.ObjectId(driverId),
  };
  if (paymentStatus) tripMatch.paymentStatus = paymentStatus;
  if (vehicleType) tripMatch.vehicleType = vehicleType;
  if (statusGroup && STATUS_GROUPS[statusGroup]) {
    tripMatch.status = { $in: STATUS_GROUPS[statusGroup] };
  }
  if (dateFrom || dateTo) {
    const dateCond: Record<string, string> = {};
    if (dateFrom) dateCond.$gte = dateFrom;
    dateCond.$lte = dateTo || dateFrom!;
    tripMatch.date = dateCond;
  }

  const [total, rawTrips] = await Promise.all([
    Trip.countDocuments(tripMatch),
    Trip.find(tripMatch)
      .sort({ date: 1, cycleIndex: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<
        {
          _id: unknown;
          tripNumber: number;
          requestId: unknown;
          driverId?: unknown;
          date: string;
          assignedDriver?: {
            name?: string;
            phone?: string;
            profilePic?: string;
            carBrand?: string;
            carModel?: string;
            modelYear?: string;
            plate?: string;
          } | null;
          paymentStatus: string;
          status: string;
          vehicleType: string;
          pickup: GeoPoint;
          dropoff: GeoPoint;
          pickupTime: string;
          arrivalTime: string;
          priceEgp: number;
          distanceKm: number;
          durationMinutes: number;
          createdAt: Date | string;
        }[]
      >(),
  ]);

  const driverIds = Array.from(
    new Set(
      rawTrips
        .map((trip) => (trip.driverId ? String(trip.driverId) : null))
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const assignedDriverEntries = await Promise.all(
    driverIds.map(
      async (driverId) =>
        [driverId, await buildAssignedDriver(driverId)] as const,
    ),
  );
  const assignedDriverById = new Map(
    assignedDriverEntries
      .filter(([, assignedDriver]) => Boolean(assignedDriver))
      .map(([driverId, assignedDriver]) => [driverId, assignedDriver]),
  );

  const requestIds = Array.from(
    new Set(rawTrips.map((t) => String(t.requestId))),
  );
  const requests = await RequestModel.find({ _id: { $in: requestIds } })
    .select("amountEgp")
    .lean<{ _id: unknown; amountEgp: number }[]>();
  const amountByRequestId = new Map(
    requests.map((r) => [String(r._id), r.amountEgp]),
  );

  return {
    total,
    page,
    rows: rawTrips.map((trip) => ({
      id: String(trip._id),
      tripNumber: trip.tripNumber,
      requestId: String(trip.requestId),
      date: trip.date,
      paymentStatus: (trip.paymentStatus as PaymentStatus) ?? "pending",
      status: (trip.status as BookingStatus) ?? "pending_payment",
      vehicleType: trip.vehicleType,
      pickupAddress: trip.pickup?.address ?? "—",
      dropoffAddress: trip.dropoff?.address ?? "—",
      pickup:
        typeof trip.pickup?.lat === "number"
          ? { lat: trip.pickup.lat, lng: trip.pickup.lng }
          : null,
      dropoff:
        typeof trip.dropoff?.lat === "number"
          ? { lat: trip.dropoff.lat, lng: trip.dropoff.lng }
          : null,
      pickupTime: trip.pickupTime,
      arrivalTime: trip.arrivalTime,
      priceEgp: trip.priceEgp,
      distanceKm: trip.distanceKm,
      durationMinutes: trip.durationMinutes,
      bookingAmountEgp:
        amountByRequestId.get(String(trip.requestId)) ?? trip.priceEgp,
      createdAt:
        trip.createdAt instanceof Date
          ? trip.createdAt.toISOString()
          : String(trip.createdAt),
      assignedDriver: trip.driverId
        ? (assignedDriverById.get(String(trip.driverId)) ?? null)
        : null,
    })),
  };
}

export async function listUserTrips(
  userId: string,
  {
    page,
    pageSize = 12,
    paymentStatus,
    vehicleType,
    statusGroup,
    dateFrom,
    dateTo,
  }: ListUserTripsOptions,
): Promise<{ rows: TripListRow[]; total: number; page: number }> {
  await connectDB();

  const tripMatch: Record<string, unknown> = {
    userId: new Types.ObjectId(userId),
  };
  if (paymentStatus) tripMatch.paymentStatus = paymentStatus;
  if (vehicleType) tripMatch.vehicleType = vehicleType;
  if (statusGroup && STATUS_GROUPS[statusGroup]) {
    tripMatch.status = { $in: STATUS_GROUPS[statusGroup] };
  }
  if (dateFrom || dateTo) {
    const dateCond: Record<string, string> = {};
    if (dateFrom) dateCond.$gte = dateFrom;
    dateCond.$lte = dateTo || dateFrom!;
    tripMatch.date = dateCond;
  }

  const [total, rawTrips] = await Promise.all([
    Trip.countDocuments(tripMatch),
    Trip.find(tripMatch)
      .sort({ date: 1, cycleIndex: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<
        {
          _id: unknown;
          tripNumber: number;
          requestId: unknown;
          driverId?: unknown;
          date: string;
          paymentStatus: string;
          status: string;
          vehicleType: string;
          pickup: GeoPoint;
          dropoff: GeoPoint;
          pickupTime: string;
          arrivalTime: string;
          priceEgp: number;
          distanceKm: number;
          durationMinutes: number;
          createdAt: Date | string;
        }[]
      >(),
  ]);

  const driverIds = Array.from(
    new Set(
      rawTrips
        .map((trip) => (trip.driverId ? String(trip.driverId) : null))
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const assignedDriverEntries = await Promise.all(
    driverIds.map(
      async (driverId) =>
        [driverId, await buildAssignedDriver(driverId)] as const,
    ),
  );
  const assignedDriverById = new Map(
    assignedDriverEntries
      .filter(([, assignedDriver]) => Boolean(assignedDriver))
      .map(([driverId, assignedDriver]) => [driverId, assignedDriver]),
  );

  const requestIds = Array.from(
    new Set(rawTrips.map((t) => String(t.requestId))),
  );
  const requests = await RequestModel.find({ _id: { $in: requestIds } })
    .select("amountEgp")
    .lean<{ _id: unknown; amountEgp: number }[]>();
  const amountByRequestId = new Map(
    requests.map((r) => [String(r._id), r.amountEgp]),
  );

  const completedTripIds = rawTrips
    .filter((trip) => trip.status === "completed")
    .map((trip) => trip._id);
  const ratings = completedTripIds.length
    ? await Rating.find({ tripId: { $in: completedTripIds } })
        .select("tripId driverRating carRating")
        .lean<{ tripId: unknown; driverRating: number; carRating: number }[]>()
    : [];
  const ratingByTripId = new Map(
    ratings.map((r) => [
      String(r.tripId),
      { driverRating: r.driverRating, carRating: r.carRating },
    ]),
  );

  return {
    total,
    page,
    rows: rawTrips.map((trip) => ({
      id: String(trip._id),
      tripNumber: trip.tripNumber,
      requestId: String(trip.requestId),
      date: trip.date,
      paymentStatus: (trip.paymentStatus as PaymentStatus) ?? "pending",
      status: (trip.status as BookingStatus) ?? "pending_payment",
      vehicleType: trip.vehicleType,
      pickupAddress: trip.pickup?.address ?? "—",
      dropoffAddress: trip.dropoff?.address ?? "—",
      pickup:
        typeof trip.pickup?.lat === "number"
          ? { lat: trip.pickup.lat, lng: trip.pickup.lng }
          : null,
      dropoff:
        typeof trip.dropoff?.lat === "number"
          ? { lat: trip.dropoff.lat, lng: trip.dropoff.lng }
          : null,
      pickupTime: trip.pickupTime,
      arrivalTime: trip.arrivalTime,
      priceEgp: trip.priceEgp,
      distanceKm: trip.distanceKm,
      durationMinutes: trip.durationMinutes,
      bookingAmountEgp:
        amountByRequestId.get(String(trip.requestId)) ?? trip.priceEgp,
      createdAt:
        trip.createdAt instanceof Date
          ? trip.createdAt.toISOString()
          : String(trip.createdAt),
      assignedDriver: trip.driverId
        ? (assignedDriverById.get(String(trip.driverId)) ?? null)
        : null,
      rating: ratingByTripId.get(String(trip._id)) ?? null,
    })),
  };
}

export interface UserTripDetail {
  id: string;
  tripNumber: number;
  requestId: string;
  date: string;
  cycleIndex: number;
  pickup: GeoPoint;
  dropoff: GeoPoint;
  vehicleType: string;
  rideType: string;
  arrivalTime: string;
  pickupTime: string;
  distanceKm: number;
  durationMinutes: number;
  priceEgp: number;
  extraPassengers: number;
  pickupStation?: StationSelection;
  dropoffStation?: StationSelection;
  seatNumbers?: number[];
  walkingMinToStation?: number;
  walkingMinFromStation?: number;
  pickupStationOptions: StationOption[];
  dropoffStationOptions: StationOption[];
  passengers: {
    sameAsMain: boolean;
    pickup?: GeoPoint | null;
    dropoff?: GeoPoint | null;
  }[];
  numberOfPassengers: number;
  stops: {
    point: GeoPoint;
    alighting: number;
    boarding: number;
    waitingMinutes: number;
  }[];
  paymentStatus: PaymentStatus;
  status: string;
  createdAt: string;
  assignedDriver?: AssignedDriver | null;
  rideId?: string;
  rideDetails?: RideDetailView | null;
  rating?: { driverRating: number; carRating: number } | null;
}

export async function getDriverTrip(
  driverId: string,
  tripId: string,
): Promise<UserTripDetail | null> {
  if (!Types.ObjectId.isValid(tripId)) return null;

  await connectDB();
  const trip = await Trip.findOne({
    _id: tripId,
    driverId: new Types.ObjectId(driverId),
  }).lean<{
    _id: unknown;
    tripNumber: number;
    requestId: unknown;
    driverId?: unknown;
    date: string;
    cycleIndex: number;
    pickup: GeoPoint;
    dropoff: GeoPoint;
    vehicleType: string;
    rideType: string;
    arrivalTime: string;
    pickupTime: string;
    distanceKm: number;
    durationMinutes: number;
    priceEgp: number;
    extraPassengers: number;
    pickupStation?: StationSelection;
    dropoffStation?: StationSelection;
    walkingMinToStation?: number;
    walkingMinFromStation?: number;
    pickupStationOptions?: StationOption[];
    dropoffStationOptions?: StationOption[];
    passengers: {
      sameAsMain: boolean;
      pickup?: GeoPoint | null;
      dropoff?: GeoPoint | null;
    }[];
    numberOfPassengers: number;
    stops: {
      point: GeoPoint;
      alighting: number;
      boarding: number;
      waitingMinutes: number;
    }[];
    paymentStatus: string;
    status: string;
    createdAt: Date | string;
  }>();

  if (!trip) return null;

  const assignedDriver = trip.driverId
    ? await buildAssignedDriver(trip.driverId)
    : null;

  return {
    ...trip,
    id: String(trip._id),
    requestId: String(trip.requestId),
    paymentStatus: (trip.paymentStatus as PaymentStatus) ?? "pending",
    pickupStationOptions: trip.pickupStationOptions ?? [],
    dropoffStationOptions: trip.dropoffStationOptions ?? [],
    createdAt:
      trip.createdAt instanceof Date
        ? trip.createdAt.toISOString()
        : String(trip.createdAt),
    assignedDriver,
  };
}

export async function getUserTrip(
  userId: string,
  tripId: string,
): Promise<UserTripDetail | null> {
  if (!Types.ObjectId.isValid(tripId)) return null;

  await connectDB();
  const trip = await Trip.findOne({
    _id: tripId,
    userId: new Types.ObjectId(userId),
  }).lean<{
    _id: unknown;
    tripNumber: number;
    requestId: unknown;
    driverId?: unknown;
    date: string;
    cycleIndex: number;
    pickup: GeoPoint;
    dropoff: GeoPoint;
    vehicleType: string;
    rideType: string;
    arrivalTime: string;
    pickupTime: string;
    distanceKm: number;
    durationMinutes: number;
    priceEgp: number;
    extraPassengers: number;
    pickupStation?: StationSelection;
    dropoffStation?: StationSelection;
    seatNumbers?: number[];
    rideId?: unknown;
    walkingMinToStation?: number;
    walkingMinFromStation?: number;
    pickupStationOptions?: StationOption[];
    dropoffStationOptions?: StationOption[];
    passengers: {
      sameAsMain: boolean;
      pickup?: GeoPoint | null;
      dropoff?: GeoPoint | null;
    }[];
    numberOfPassengers: number;
    stops: {
      point: GeoPoint;
      alighting: number;
      boarding: number;
      waitingMinutes: number;
    }[];
    paymentStatus: string;
    status: string;
    createdAt: Date | string;
  }>();

  if (!trip) return null;

  const assignedDriver = trip.driverId
    ? await buildAssignedDriver(trip.driverId)
    : null;

  const { getRideById } = await import("./rideService");
  const rideDetails = trip.rideId
    ? await getRideById(String(trip.rideId))
    : null;

  const rating =
    trip.status === "completed"
      ? await Rating.findOne({ tripId: trip._id })
          .select("driverRating carRating")
          .lean<{ driverRating: number; carRating: number } | null>()
      : null;

  return {
    ...trip,
    id: String(trip._id),
    requestId: String(trip.requestId),
    seatNumbers: trip.seatNumbers ?? [],
    rideId: trip.rideId ? String(trip.rideId) : undefined,
    rideDetails,
    rating: rating ? { driverRating: rating.driverRating, carRating: rating.carRating } : null,
    paymentStatus: (trip.paymentStatus as PaymentStatus) ?? "pending",
    pickupStationOptions: trip.pickupStationOptions ?? [],
    dropoffStationOptions: trip.dropoffStationOptions ?? [],
    createdAt:
      trip.createdAt instanceof Date
        ? trip.createdAt.toISOString()
        : String(trip.createdAt),
    assignedDriver,
  };
}
