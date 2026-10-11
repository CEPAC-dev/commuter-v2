import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Trip } from "@/models/Trip";
import { Request as RequestModel } from "@/models/Request";
import { User } from "@/models/User";
import { Driver } from "@/models/Driver";
import { Rating } from "@/models/Rating";
import { Payment } from "@/models/Payment";
import type {
  BookingStatus,
  PaymentStatus,
  RideDetailView,
  TripListRow,
} from "@/types/booking";
import type { GeoPoint, StationSelection } from "@/types/geo";
import { getCairoNowParts, hasPastPickup } from "@/lib/time/cairoTime";
import { buildHistoryTripMatch } from "@/lib/tripHistoryFilters.ts";

export interface StationOption extends StationSelection {
  distanceKm: number;
  walkingMin: number;
}

export interface AssignedDriver {
  name?: string;
  phone?: string;
  profilePic?: string;
  profilePicture?: string;
  carBrand?: string;
  carModel?: string;
  carType?: string;
  modelYear?: string;
  vehicleColor?: string;
  carColor?: string;
  carCapacity?: number;
  carImage?: string;
  plate?: string;
  plateChar1?: string;
  plateChar2?: string;
  plateChar3?: string;
  plateDigits?: string;
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
        "carBrand carModel modelYear vehicleColor plateChar1 plateChar2 plateChar3 plateDigits documents",
      )
      .lean<{
        carBrand?: string;
        carModel?: string;
        modelYear?: number;
        vehicleColor?: string;
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
    vehicleColor: driver?.vehicleColor,
    carColor: driver?.vehicleColor,
    plate,
  };
}

export interface StationOption extends StationSelection {
  distanceKm: number;
  walkingMin: number;
}

type StatusGroup = "pending_payment" | "upcoming" | "ongoing" | "previous";

const STATUS_GROUPS = {
  pending_payment: ["pending_payment"],
  upcoming: ["submitted", "confirmed"],
  ongoing: ["active", "matched"],
  previous: ["completed", "cancelled", "time_out", "nomatch"],
} satisfies Record<StatusGroup, BookingStatus[]>;

export interface ListUserTripsOptions {
  page: number;
  pageSize?: number;
  groupByRequest?: boolean;
  fetchAll?: boolean;
  tripNumber?: number;
  paymentStatus?: PaymentStatus;
  vehicleType?: string;
  statusGroup?: StatusGroup;
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
          assignedDriver?: AssignedDriver | null;
          date: string;
          paymentStatus: string;
          status: string;
          rejectionReason?: string | null;
          reviewedAt?: Date | string | null;
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
    new Set(rawTrips.flatMap((trip) => trip.requestId ? [String(trip.requestId)] : [])),
  );
  const requests = requestIds.length
    ? await RequestModel.find({ _id: { $in: requestIds } })
    .select("amountEgp")
    .lean<{ _id: unknown; amountEgp: number }[]>()
    : [];
  const amountByRequestId = new Map(
    requests.map((r) => [String(r._id), r.amountEgp]),
  );

  return {
    total,
    page,
    rows: rawTrips.map((trip) => ({
      id: String(trip._id),
      tripNumber: trip.tripNumber,
      requestId: trip.requestId ? String(trip.requestId) : String(trip._id),
      isStandalone: trip.requestId == null,
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
        (trip.requestId
          ? amountByRequestId.get(String(trip.requestId))
          : undefined) ?? trip.priceEgp,
      createdAt:
        trip.createdAt instanceof Date
          ? trip.createdAt.toISOString()
          : String(trip.createdAt),
      assignedDriver: trip.driverId
        ? (trip.assignedDriver ??
          assignedDriverById.get(String(trip.driverId)) ??
          null)
        : (trip.assignedDriver ?? null),
    })),
  };
}

export async function listUserTrips(
  userId: string,
  {
    page,
    pageSize = 12,
    groupByRequest = false,
    fetchAll = false,
    tripNumber,
    paymentStatus,
    vehicleType,
    statusGroup,
    dateFrom,
    dateTo,
  }: ListUserTripsOptions,
): Promise<{
  rows: TripListRow[];
  total: number;
  page: number;
  totalRequests?: number;
}> {
  await connectDB();

  const tripMatch: Record<string, unknown> = {
    ...buildHistoryTripMatch(userId, {
      tripNumber,
      from: groupByRequest && tripNumber != null ? undefined : dateFrom,
      to: groupByRequest && tripNumber != null ? undefined : dateTo,
    }),
    userId: new Types.ObjectId(userId),
  };
  if (paymentStatus) tripMatch.paymentStatus = paymentStatus;
  if (vehicleType) tripMatch.vehicleType = vehicleType;
  if (statusGroup && STATUS_GROUPS[statusGroup]) {
    tripMatch.status = { $in: STATUS_GROUPS[statusGroup] };
  }

  type UserTripListDocument = {
    _id: unknown;
    tripNumber: number;
    requestId: unknown;
    driverId?: unknown;
    date: string;
    paymentStatus: string;
    status: string;
    rejectionReason?: string | null;
    reviewedAt?: Date | string | null;
    vehicleType: string;
    pickup: GeoPoint;
    dropoff: GeoPoint;
    pickupTime: string;
    arrivalTime: string;
    priceEgp: number;
    distanceKm: number;
    durationMinutes: number;
    createdAt: Date | string;
    cancelledBy?: string;
    cancelReason?: string;
    cancellation?: {
      refundStatus?: string;
      refundAmount?: number;
      reason?: string;
    } | null;
  };

  let total: number;
  let totalRequests: number | undefined;
  let rawTrips: UserTripListDocument[];
  if (groupByRequest) {
    const [matchedTripCount, matchingRequestIds] = await Promise.all([
      Trip.countDocuments(tripMatch),
      Trip.distinct("requestId", tripMatch),
    ]);
    total = matchedTripCount;
    let scopedRequestIds = matchingRequestIds.filter(
      (requestId): requestId is NonNullable<typeof requestId> =>
        requestId !== null && requestId !== undefined,
    );
    const standaloneMatch: Record<string, unknown> = {
      ...tripMatch,
      requestId: null,
    };
    if (tripNumber != null && (dateFrom || dateTo)) {
      const dateMatch = {
        ...buildHistoryTripMatch(userId, { from: dateFrom, to: dateTo }),
        userId: new Types.ObjectId(userId),
      };
      const [dateRequestIds, dateStandaloneIds] = await Promise.all([
        Trip.distinct("requestId", dateMatch),
        Trip.distinct("_id", {
          ...dateMatch,
          ...tripMatch,
          requestId: null,
        }),
      ]);
      const dateRequestIdSet = new Set(dateRequestIds.map(String));
      scopedRequestIds = matchingRequestIds.filter((requestId) =>
        requestId != null && dateRequestIdSet.has(String(requestId)),
      );
      standaloneMatch._id = { $in: dateStandaloneIds };
    }
    const candidateLimit = fetchAll ? 0 : page * pageSize;
    const requestQuery = scopedRequestIds.length
      ? RequestModel.find({
          _id: { $in: scopedRequestIds },
          userId: new Types.ObjectId(userId),
        })
          .select("_id createdAt")
          .sort({ createdAt: -1 })
      : null;
    const standaloneQuery = Trip.find(standaloneMatch)
      .select("_id createdAt")
      .sort({ createdAt: -1 });
    if (candidateLimit > 0) {
      requestQuery?.limit(candidateLimit);
      standaloneQuery.limit(candidateLimit);
    }
    const [requestCandidates, standaloneCandidates, standaloneCount] =
      await Promise.all([
        requestQuery
          ? requestQuery.lean<{ _id: Types.ObjectId; createdAt: Date | string }[]>()
          : Promise.resolve([]),
        standaloneQuery.lean<{ _id: Types.ObjectId; createdAt: Date | string }[]>(),
        Trip.countDocuments(standaloneMatch),
      ]);
    const requestGroups = requestCandidates.map((request) => ({
      kind: "request" as const,
      id: String(request._id),
      createdAt: request.createdAt,
    }));
    const standaloneGroups = standaloneCandidates.map((trip) => ({
      kind: "trip" as const,
      id: String(trip._id),
      createdAt: trip.createdAt,
    }));
    const sortedGroups = [...requestGroups, ...standaloneGroups].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() -
        new Date(left.createdAt).getTime(),
    );
    const selectedGroups = fetchAll
      ? sortedGroups
      : sortedGroups.slice((page - 1) * pageSize, page * pageSize);
    const pageRequestIds = selectedGroups
      .filter((group) => group.kind === "request")
      .map((group) => new Types.ObjectId(group.id));
    const pageStandaloneIds = selectedGroups
      .filter((group) => group.kind === "trip")
      .map((group) => new Types.ObjectId(group.id));
    totalRequests = scopedRequestIds.length + standaloneCount;

    const selectedTripConditions: Record<string, unknown>[] = [];
    if (pageRequestIds.length) {
      selectedTripConditions.push({ requestId: { $in: pageRequestIds } });
    }
    if (pageStandaloneIds.length) {
      selectedTripConditions.push({
        _id: { $in: pageStandaloneIds },
        requestId: null,
      });
    }
    rawTrips = selectedTripConditions.length
      ? await Trip.find({
          userId: new Types.ObjectId(userId),
          $or: selectedTripConditions,
        })
          .sort({ date: 1, cycleIndex: 1 })
          .lean<UserTripListDocument[]>()
      : [];
  } else {
    const tripsQuery = Trip.find(tripMatch).sort({ date: 1, cycleIndex: 1 });
    if (!fetchAll) tripsQuery.skip((page - 1) * pageSize).limit(pageSize);
    const [tripCount, trips] = await Promise.all([
      Trip.countDocuments(tripMatch),
      tripsQuery.lean<UserTripListDocument[]>(),
    ]);
    total = tripCount;
    rawTrips = trips;
  }

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
    new Set(rawTrips.flatMap((trip) => trip.requestId ? [String(trip.requestId)] : [])),
  );
  const requests = requestIds.length
    ? await RequestModel.find({
        _id: { $in: requestIds },
        userId: new Types.ObjectId(userId),
      })
        .select("amountEgp status paymentStatus rejectionReason reviewedAt")
        .lean<
      {
        _id: unknown;
        amountEgp: number;
        status: BookingStatus;
        paymentStatus: PaymentStatus;
        rejectionReason?: string | null;
        reviewedAt?: Date | null;
      }[]
        >()
    : [];
  const amountByRequestId = new Map(
    requests.map((r) => [String(r._id), r.amountEgp]),
  );
  const requestById = new Map(requests.map((request) => [String(request._id), request]));
  const requestTrips = requestIds.length
    ? await Trip.find({ requestId: { $in: requestIds } })
        .select("requestId date pickupTime")
        .lean<{ requestId: unknown; date: string; pickupTime: string }[]>()
    : [];
  const nowCairo = getCairoNowParts();
  const hasPastTripByRequestId = new Map<string, boolean>();
  for (const trip of requestTrips) {
    const requestId = String(trip.requestId);
    if (
      hasPastPickup([{ date: trip.date, pickupTime: trip.pickupTime }], nowCairo)
    ) {
      hasPastTripByRequestId.set(requestId, true);
    }
  }

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
    ...(totalRequests !== undefined ? { totalRequests } : {}),
    page,
    rows: rawTrips.map((trip) => {
      const requestId = trip.requestId
        ? String(trip.requestId)
        : String(trip._id);
      const isStandalone = trip.requestId == null;
      const parentRequest = requestById.get(requestId);
      return {
      id: String(trip._id),
      tripNumber: trip.tripNumber,
      requestId,
      isStandalone,
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
        (trip.requestId ? amountByRequestId.get(requestId) : undefined) ??
        trip.priceEgp,
      parentRequestStatus: parentRequest?.status,
      parentPaymentStatus: parentRequest?.paymentStatus,
      rejectionReason: isStandalone
        ? trip.rejectionReason ?? null
        : parentRequest?.rejectionReason ?? null,
      reviewedAt: isStandalone
        ? trip.reviewedAt instanceof Date
          ? trip.reviewedAt.toISOString()
          : trip.reviewedAt ?? null
        : parentRequest?.reviewedAt?.toISOString() ?? null,
      hasPastTrip: trip.requestId
        ? hasPastTripByRequestId.get(requestId) ?? false
        : hasPastPickup(
            [{ date: trip.date, pickupTime: trip.pickupTime }],
            nowCairo,
          ),
      cancelledBy: trip.cancelledBy,
      cancelReason: trip.cancelReason,
      cancellation: trip.cancellation,
      createdAt:
        trip.createdAt instanceof Date
          ? trip.createdAt.toISOString()
          : String(trip.createdAt),
      assignedDriver: trip.driverId
        ? (assignedDriverById.get(String(trip.driverId)) ?? null)
        : null,
      rating: ratingByTripId.get(String(trip._id)) ?? null,
      };
    }),
  };
}

export interface UserTripDetail {
  id: string;
  tripNumber: number;
  requestId: string;
  isStandalone: boolean;
  otherTrips?: { id: string; date: string }[];
  requestAmountEgp?: number;
  paymentBreakdown?: { walletAmountEgp: number; gatewayAmountEgp: number } | null;
  parentRequestStatus?: BookingStatus;
  parentPaymentStatus?: PaymentStatus;
  rejectionReason?: string | null;
  reviewedAt?: string | null;
  hasPastTrip?: boolean;
  cancelledBy?: string;
  cancelReason?: string;
  cancellation?: {
    refundStatus?: string;
    refundAmount?: number;
    reason?: string;
  } | null;
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
    rejectionReason?: string | null;
    reviewedAt?: Date | string | null;
    cancelledBy?: string;
    cancelReason?: string;
    cancellation?: {
      refundStatus?: string;
      refundAmount?: number;
      reason?: string;
    } | null;
    createdAt: Date | string;
  }>();

  if (!trip) return null;

  const parentRequest = trip.requestId
    ? await RequestModel.findById(trip.requestId)
        .select("amountEgp status paymentStatus rejectionReason")
        .lean<{
          amountEgp: number;
          status: BookingStatus;
          paymentStatus: PaymentStatus;
          rejectionReason?: string | null;
        } | null>()
    : null;

  const assignedDriver = trip.driverId
    ? await buildAssignedDriver(trip.driverId)
    : null;

  return {
    ...trip,
    id: String(trip._id),
    requestId: trip.requestId ? String(trip.requestId) : String(trip._id),
    isStandalone: trip.requestId == null,
    requestAmountEgp: parentRequest?.amountEgp ?? trip.priceEgp,
    parentRequestStatus: parentRequest?.status,
    parentPaymentStatus: parentRequest?.paymentStatus,
    rejectionReason:
      (trip.requestId ? parentRequest?.rejectionReason : trip.rejectionReason) ??
      null,
    reviewedAt: trip.requestId
      ? null
      : trip.reviewedAt instanceof Date
        ? trip.reviewedAt.toISOString()
        : trip.reviewedAt ?? null,
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
  includeSiblingTrips = false,
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
    rejectionReason?: string | null;
    reviewedAt?: Date | string | null;
    cancelledBy?: string;
    cancelReason?: string;
    cancellation?: {
      refundStatus?: string;
      refundAmount?: number;
      reason?: string;
    } | null;
    createdAt: Date | string;
  }>();

  if (!trip) return null;

  const parentRequest = includeSiblingTrips && trip.requestId
    ? await RequestModel.findOne({
        _id: trip.requestId,
        userId: new Types.ObjectId(userId),
      })
        .select("amountEgp status paymentStatus rejectionReason reviewedAt")
        .lean<{
          amountEgp: number;
          status: BookingStatus;
          paymentStatus: PaymentStatus;
          rejectionReason?: string | null;
          reviewedAt?: Date | null;
        } | null>()
    : null;
  const requestTrips = includeSiblingTrips && trip.requestId
    ? await Trip.find({
        requestId: trip.requestId,
        userId: new Types.ObjectId(userId),
      })
        .select("_id date pickupTime cycleIndex")
        .sort({ date: 1, cycleIndex: 1 })
        .lean<{
          _id: unknown;
          date: string;
          pickupTime: string;
          cycleIndex: number;
        }[]>()
    : [];
  const paymentBreakdown = includeSiblingTrips
    ? await Payment.findOne({
        bookingId: trip.requestId ?? trip._id,
        userId: new Types.ObjectId(userId),
      })
        .select("walletAmountEgp gatewayAmountEgp")
        .sort({ createdAt: -1 })
        .lean<{ walletAmountEgp: number; gatewayAmountEgp: number } | null>()
    : null;
  const hasPastTrip = trip.requestId
    ? hasPastPickup(requestTrips, getCairoNowParts())
    : hasPastPickup(
        [{ date: trip.date, pickupTime: trip.pickupTime }],
        getCairoNowParts(),
      );
  const otherTrips = requestTrips.filter(
    (requestTrip) => String(requestTrip._id) !== String(trip._id),
  );

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
    requestId: trip.requestId ? String(trip.requestId) : String(trip._id),
    isStandalone: trip.requestId == null,
    requestAmountEgp: parentRequest?.amountEgp ?? trip.priceEgp,
    paymentBreakdown,
    parentRequestStatus: parentRequest?.status,
    parentPaymentStatus: parentRequest?.paymentStatus,
    rejectionReason: trip.requestId
      ? parentRequest?.rejectionReason ?? null
      : trip.rejectionReason ?? null,
    reviewedAt: trip.requestId
      ? parentRequest?.reviewedAt?.toISOString() ?? null
      : trip.reviewedAt instanceof Date
        ? trip.reviewedAt.toISOString()
        : trip.reviewedAt ?? null,
    hasPastTrip,
    otherTrips: otherTrips.map((otherTrip) => ({
      id: String(otherTrip._id),
      date: otherTrip.date,
    })),
    seatNumbers: trip.seatNumbers ?? [],
    rideId: trip.rideId ? String(trip.rideId) : undefined,
    rideDetails,
    rating: rating
      ? { driverRating: rating.driverRating, carRating: rating.carRating }
      : null,
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
