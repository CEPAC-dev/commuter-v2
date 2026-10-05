import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { getOrCreateWallet } from "@/lib/wallet/wallet";
import type {
  BookingRow,
  BookingStatus,
  BookingTripRow,
  PaymentStatus,
} from "@/types/booking";
import type { GeoPoint, StationSelection } from "@/types/geo";
import {
  buildPendingRequestExpiryFilter,
  buildPendingTripExpiryFilter,
} from "@/lib/pendingRequestHardening";
import { getCairoNowParts } from "@/lib/cancellationPolicy";
import { hasPastTrip as hasPastPickupTime } from "@/lib/admin/waitingList";

const EXPIRY_MS = 2 * 60 * 60 * 1000;

export async function expireStaleForUser(userId: string): Promise<void> {
  await connectDB();

  const cutoff = new Date(Date.now() - EXPIRY_MS);
  const expireFilter = buildPendingRequestExpiryFilter(cutoff, userId);
  const expiringRequests = await Request.find(expireFilter)
    .select("_id")
    .lean<{ _id: Types.ObjectId }[]>();
  const requestIds = expiringRequests.map((request) => request._id);
  if (requestIds.length === 0) return;

  await Request.updateMany(
    { _id: { $in: requestIds }, ...expireFilter },
    { $set: { status: "time_out", paymentStatus: "expired" } },
  );
  await Trip.updateMany(
    buildPendingTripExpiryFilter(requestIds),
    { $set: { status: "time_out", paymentStatus: "expired" } },
  );
}

export async function expireStaleRequest(
  requestId: string,
  userId: string,
): Promise<void> {
  await connectDB();

  const cutoff = new Date(Date.now() - EXPIRY_MS);
  const expireFilter = buildPendingRequestExpiryFilter(cutoff, userId);
  const expiringRequest = await Request.findOne({
    _id: requestId,
    ...expireFilter,
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId }>();
  if (!expiringRequest) return;

  await Request.updateOne(
    { _id: expiringRequest._id, ...expireFilter },
    { $set: { status: "time_out", paymentStatus: "expired" } },
  );
  await Trip.updateMany(
    buildPendingTripExpiryFilter([expiringRequest._id]),
    { $set: { status: "time_out", paymentStatus: "expired" } },
  );
}

export interface ListUserRequestsOptions {
  page: number;
  pageSize?: number;
  paymentStatus?: PaymentStatus;
  status?: BookingStatus;
}

export async function listUserRequests(
  userId: string,
  { page, pageSize = 8, paymentStatus, status }: ListUserRequestsOptions,
): Promise<{ rows: BookingRow[]; total: number; page: number }> {
  await connectDB();

  const query: Record<string, unknown> = { userId };
  if (paymentStatus) query.paymentStatus = paymentStatus;
  if (status) query.status = status;

  const total = await Request.countDocuments(query);
  const raw = await Request.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .lean();

  const rawList = raw as Record<string, unknown>[];
  const requestIds = rawList.map((request) => request._id);
  const firstDateByRequest = new Map<string, string>(
    rawList.map((request) => [
      String(request._id),
      ((request.dates as string[]) ?? [])[0] ?? "",
    ]),
  );
  const tripDocs = await Trip.find({ requestId: { $in: requestIds } })
    .sort({ date: 1, cycleIndex: 1 })
    .lean<
      {
        requestId: unknown;
        date: string;
        cycleIndex: number;
        vehicleType: string;
        pickup: GeoPoint;
        dropoff: GeoPoint;
        pickupTime: string;
        arrivalTime: string;
        priceEgp: number;
      }[]
    >();

  const nowCairo = getCairoNowParts();
  const pastTripByRequest = new Map<string, boolean>();
  for (const trip of tripDocs) {
    const requestId = String(trip.requestId);
    if (
      hasPastPickupTime(
        [{ date: trip.date, pickupTime: trip.pickupTime }],
        nowCairo,
      )
    ) {
      pastTripByRequest.set(requestId, true);
    }
  }

  const tripsByRequest = new Map<string, BookingTripRow[]>();
  for (const trip of tripDocs) {
    const requestId = String(trip.requestId);
    if (trip.date !== firstDateByRequest.get(requestId)) continue;
    if (!tripsByRequest.has(requestId)) tripsByRequest.set(requestId, []);
    tripsByRequest.get(requestId)!.push({
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
    });
  }

  return {
    total,
    page,
    rows: rawList.map((request) => {
      const requestId = String(request._id);
      const status = (request.status as BookingStatus) ?? "pending_payment";
      return {
        id: requestId,
        dates: (request.dates as string[]) ?? [],
        amountEgp: request.amountEgp as number,
        paymentStatus: (request.paymentStatus as PaymentStatus) ?? "pending",
        status,
        rejectionReason:
          typeof request.rejectionReason === "string"
            ? request.rejectionReason
            : null,
        reviewedAt:
          request.reviewedAt instanceof Date
            ? request.reviewedAt.toISOString()
            : request.reviewedAt
              ? String(request.reviewedAt)
              : null,
        ...(status === "approved"
          ? { hasPastTrip: pastTripByRequest.get(requestId) ?? false }
          : {}),
        createdAt:
          request.createdAt instanceof Date
            ? request.createdAt.toISOString()
            : String(request.createdAt),
        trips: tripsByRequest.get(requestId) ?? [],
      };
    }),
  };
}

export interface RequestTripDetail {
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
}

export interface UserRequestDetail {
  request: {
    id: string;
    dates: string[];
    amountEgp: number;
    paymentStatus: PaymentStatus;
    status: BookingStatus;
    rejectionReason: string | null;
    reviewedAt: string | null;
    hasPastTrip?: boolean;
    createdAt: string;
  };
  trips: RequestTripDetail[];
  walletBalance: number;
}

export async function getUserRequest(
  userId: string,
  requestId: string,
): Promise<UserRequestDetail | null> {
  if (!Types.ObjectId.isValid(requestId)) return null;

  await connectDB();
  const [request, trips, wallet] = await Promise.all([
    Request.findOne({ _id: requestId, userId }).lean<Record<string, unknown>>(),
    Trip.find({ requestId, userId: new Types.ObjectId(userId) })
      .sort({ date: 1, cycleIndex: 1 })
      .lean<RequestTripDetail[]>(),
    getOrCreateWallet(userId),
  ]);

  if (!request) return null;

  const status = (request.status as BookingStatus) ?? "pending_payment";
  const nowCairo = getCairoNowParts();
  const hasPastTrip =
    status === "approved" &&
    hasPastPickupTime(
      trips.map((trip) => ({ date: trip.date, pickupTime: trip.pickupTime })),
      nowCairo,
    );

  return {
    request: {
      id: String(request._id),
      dates: (request.dates as string[]) ?? [],
      amountEgp: request.amountEgp as number,
      paymentStatus: (request.paymentStatus as PaymentStatus) ?? "pending",
      status,
      rejectionReason:
        typeof request.rejectionReason === "string"
          ? request.rejectionReason
          : null,
      reviewedAt:
        request.reviewedAt instanceof Date
          ? request.reviewedAt.toISOString()
          : request.reviewedAt
            ? String(request.reviewedAt)
            : null,
      ...(status === "approved" ? { hasPastTrip } : {}),
      createdAt:
        request.createdAt instanceof Date
          ? request.createdAt.toISOString()
          : String(request.createdAt),
    },
    trips,
    walletBalance: wallet.balanceEgp ?? 0,
  };
}
