import { Types } from "mongoose";
import { Trip } from "@/models/Trip";
import { createNotification } from "@/lib/notifications/createNotification";
import { getNoShowTripNotificationPayload } from "@/lib/notifications/noShowTripPayload";

export async function notifyPassengersOfNoShowTrips(tripIds: string[]) {
  try {
    const validTripIds = tripIds.filter(Types.ObjectId.isValid);
    if (validTripIds.length === 0) return;
    const trips = await Trip.find({
      _id: { $in: validTripIds },
      status: "no_show",
    })
      .select("_id userId")
      .lean<{ _id: Types.ObjectId; userId: Types.ObjectId }[]>();

    const results = await Promise.allSettled(
      trips.map((trip) =>
        createNotification({
          userId: String(trip.userId),
          ...getNoShowTripNotificationPayload(String(trip._id)),
        }),
      ),
    );
    for (const result of results) {
      if (
        result.status === "rejected" &&
        !(
          typeof result.reason === "object" &&
          result.reason !== null &&
          "code" in result.reason &&
          result.reason.code === 11000
        )
      ) {
        console.error("[no-show] Passenger notification failed");
      }
    }
  } catch {
    console.error("[no-show] Notification processing failed");
  }
}
