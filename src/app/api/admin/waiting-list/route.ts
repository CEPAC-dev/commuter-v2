import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { PromoCode } from "@/models/PromoCode";
import { getCairoNowParts } from "@/lib/cancellationPolicy";
import {
  WAITING_LIST_PASSENGER_SELECT,
  countWaitingListRows,
  hasPastWaitingListTrip,
  mapWaitingListRequest,
  mapWaitingListTrip,
  paginateWaitingListRows,
  type WaitingListPassengerRecord,
  type WaitingListRequestRecord,
  type WaitingListTripRecord,
} from "@/lib/admin/waitingList";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(req.url);
  const requestedPage = Number(searchParams.get("page") ?? "1");
  const requestedLimit = Number(searchParams.get("limit") ?? "20");
  const page =
    Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit =
    Number.isInteger(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, 50)
      : 20;

  await connectDB();

  const query = { status: "waiting_list" };
  const fetchLimit = page * limit;
  const [requests, standaloneTrips, requestCount, tripCount] =
    await Promise.all([
      Request.find(query)
        .select("_id userId dates amountEgp note tripIds createdAt")
        .populate({ path: "userId", select: WAITING_LIST_PASSENGER_SELECT })
        .sort({ createdAt: 1, _id: 1 })
        .limit(fetchLimit)
        .lean(),
      Trip.find({ ...query, requestId: null })
        .select(
          "_id userId requestId date pickup dropoff pickupTime arrivalTime vehicleType numberOfPassengers priceEgp appliedPromoCode note createdAt",
        )
        .populate({ path: "userId", select: WAITING_LIST_PASSENGER_SELECT })
        .sort({ createdAt: 1, _id: 1 })
        .limit(fetchLimit)
        .lean(),
      Request.countDocuments(query),
      Trip.countDocuments({ ...query, requestId: null }),
    ]);

  const rows = [
    ...requests.map((request) => ({
      kind: "request" as const,
      record: request,
    })),
    ...standaloneTrips.map((trip) => ({
      kind: "trip" as const,
      record: trip,
    })),
  ];
  const selectedRows = paginateWaitingListRows(rows, page, limit);
  const selectedRequestIds = selectedRows
    .filter((row) => row.kind === "request")
    .map((row) => row.record._id);
  const legacyTrips = selectedRequestIds.length
    ? await Trip.find({
        requestId: { $in: selectedRequestIds },
        status: { $ne: "cancelled" },
      })
        .select(
          "_id requestId date pickup dropoff pickupTime arrivalTime vehicleType numberOfPassengers preferedGender priceEgp appliedPromoCode",
        )
        .sort({ date: 1, cycleIndex: 1 })
        .lean()
    : [];
  const promoIds = [
    ...legacyTrips.map((trip) => trip.appliedPromoCode),
    ...selectedRows
      .filter((row) => row.kind === "trip")
      .map((row) => row.record.appliedPromoCode),
  ].filter(
    (promoId): promoId is Types.ObjectId => promoId instanceof Types.ObjectId,
  );
  const promoCodes = promoIds.length
    ? await PromoCode.find({ _id: { $in: promoIds } })
        .select("_id code")
        .lean()
    : [];
  const promoCodeById = new Map(
    promoCodes.map((promo) => [String(promo._id), promo.code]),
  );
  const tripsByRequest = new Map<string, WaitingListTripRecord[]>();
  for (const trip of legacyTrips) {
    const requestId = String(trip.requestId);
    const groupedTrips = tripsByRequest.get(requestId) ?? [];
    groupedTrips.push(trip as unknown as WaitingListTripRecord);
    tripsByRequest.set(requestId, groupedTrips);
  }

  const cairoNow = getCairoNowParts();
  const data = selectedRows.map((row) => {
    if (row.kind === "trip") {
      const trip = row.record as unknown as WaitingListTripRecord & {
        createdAt: Date | string;
      };
      const promoCode = trip.appliedPromoCode
        ? promoCodeById.get(String(trip.appliedPromoCode))
        : undefined;
      return mapWaitingListTrip({
        trip,
        passenger: trip.userId as WaitingListPassengerRecord | null,
        promoCodes: promoCode ? [promoCode] : [],
        hasPastTrip: hasPastWaitingListTrip(
          [{ date: trip.date, pickupTime: trip.pickupTime }],
          cairoNow,
        ),
      });
    }

    const request = row.record as unknown as WaitingListRequestRecord & {
      userId: WaitingListPassengerRecord | null;
    };
    const requestTrips = tripsByRequest.get(String(request._id)) ?? [];
    const requestPromoCodes = Array.from(
      new Set(
        requestTrips
          .map((trip) => {
            const promoId = trip.appliedPromoCode;
            return promoId ? promoCodeById.get(String(promoId)) : undefined;
          })
          .filter((code): code is string => Boolean(code)),
      ),
    );
    return mapWaitingListRequest({
      request,
      passenger: request.userId,
      trips: requestTrips,
      promoCodes: requestPromoCodes,
      hasPastTrip: hasPastWaitingListTrip(
        requestTrips as { date: string; pickupTime: string }[],
        cairoNow,
      ),
    });
  });
  const total = countWaitingListRows(requestCount, tripCount);

  return NextResponse.json({
    data,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}
