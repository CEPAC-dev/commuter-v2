import { Types } from "mongoose";
import { Payment } from "@/models/Payment";
import { Request } from "@/models/Request";
import { Trip } from "@/models/Trip";
import { buildRequestSummaryUpdate } from "@/lib/payments/requestSummary";

export async function reconcileRequestSummary(
  requestId: string,
): Promise<void> {
  if (!Types.ObjectId.isValid(requestId)) return;
  const requestObjectId = new Types.ObjectId(requestId);
  const [request, trips, payment] = await Promise.all([
    Request.findById(requestObjectId).select("status paymentStatus").lean(),
    Trip.find({ requestId: requestObjectId }).select("status").lean<
      {
        status: string;
      }[]
    >(),
    Payment.findOne({ bookingId: requestObjectId })
      .sort({ createdAt: -1 })
      .select("overallStatus")
      .lean<{ overallStatus: string } | null>(),
  ]);
  if (!request) return;

  const update = buildRequestSummaryUpdate({
    tripStatuses: trips.map((trip) => trip.status),
    paymentOverallStatus: payment?.overallStatus,
  });

  if (Object.keys(update).length > 0) {
    await Request.updateOne({ _id: requestObjectId }, { $set: update });
  }
}
