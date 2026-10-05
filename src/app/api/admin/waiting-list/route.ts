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
  hasPastWaitingListTrip,
  mapWaitingListRequest,
} from "@/lib/admin/waitingList";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(req.url);
  const requestedPage = Number(searchParams.get("page") ?? "1");
  const requestedLimit = Number(searchParams.get("limit") ?? "20");
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const limit = Number.isInteger(requestedLimit) && requestedLimit > 0
    ? Math.min(requestedLimit, 50)
    : 20;

  await connectDB();

  const query = { status: "waiting_list" };
  const [requests, total] = await Promise.all([
    Request.find(query)
      .select("_id userId dates amountEgp note tripIds createdAt")
      .populate({ path: "userId", select: WAITING_LIST_PASSENGER_SELECT })
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Request.countDocuments(query),
  ]);

  const requestIds = requests.map((request) => request._id);
  const trips = requestIds.length
    ? await Trip.find({ requestId: { $in: requestIds } })
        .select("_id requestId date pickup dropoff pickupTime arrivalTime vehicleType numberOfPassengers priceEgp appliedPromoCode")
        .sort({ date: 1, cycleIndex: 1 })
        .lean()
    : [];

  const promoIds = trips
    .map((trip) => trip.appliedPromoCode)
    .filter((promoId): promoId is Types.ObjectId => promoId instanceof Types.ObjectId);
  const promoCodes = promoIds.length
    ? await PromoCode.find({ _id: { $in: promoIds } }).select("_id code").lean()
    : [];
  const promoCodeById = new Map(promoCodes.map((promo) => [String(promo._id), promo.code]));
  const cairoNow = getCairoNowParts();
  const tripsByRequest = new Map<string, Record<string, any>[]>();
  for (const trip of trips) {
    const requestId = String(trip.requestId);
    const rows = tripsByRequest.get(requestId) ?? [];
    rows.push(trip as Record<string, any>);
    tripsByRequest.set(requestId, rows);
  }

  const data = requests.map((request) => {
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
      request: request as Record<string, any>,
      passenger: request.userId as Record<string, any> | null,
      trips: requestTrips,
      promoCodes: requestPromoCodes,
      hasPastTrip: hasPastWaitingListTrip(
        requestTrips as { date: string; pickupTime: string }[],
        cairoNow,
      ),
    });
  });

  return NextResponse.json({
    data,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}
