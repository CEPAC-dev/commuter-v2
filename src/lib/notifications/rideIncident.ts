import { Types } from "mongoose";
import { RideIncident } from "@/models/RideIncident";
import { Ride } from "@/models/Ride";
import { Trip } from "@/models/Trip";
import { createNotification } from "@/lib/notifications/createNotification";
import { notifyAdminsOfRideIncident } from "@/lib/notifications/adminActivity";
import { getRideIncidentPassengerNotificationPayload } from "@/lib/notifications/rideIncidentPayload";

export async function notifyRideIncidentCreated(incidentId: string) {
  try {
    if (!Types.ObjectId.isValid(incidentId)) return;
    const incident = await RideIncident.findById(incidentId)
      .select("rideId type rideStatusAtReport affectedTripIds")
      .lean();
    if (!incident) return;

    const ride = await Ride.findById(incident.rideId)
      .select("rideNumber")
      .lean();
    if (ride) {
      try {
        await notifyAdminsOfRideIncident({
          incidentId,
          rideId: String(incident.rideId),
          rideNumber: Number(ride.rideNumber ?? 0),
          incidentType: incident.type,
          rideStatusAtReport: incident.rideStatusAtReport,
        });
      } catch {
        console.error("[ride-incident] Admin notification failed");
      }
    }

    const trips = await Trip.find({
      _id: { $in: incident.affectedTripIds },
    })
      .select("_id userId")
      .lean<{ _id: Types.ObjectId; userId: Types.ObjectId }[]>();
    const recipients = new Map<string, string>();
    for (const trip of trips) {
      const userId = String(trip.userId);
      if (!recipients.has(userId)) recipients.set(userId, String(trip._id));
    }

    await Promise.all(
      [...recipients.entries()].map(async ([userId, tripId]) => {
        try {
          await createNotification({
            userId,
            ...getRideIncidentPassengerNotificationPayload({
              incidentId,
              tripId,
            }),
          });
        } catch (error) {
          if (
            typeof error === "object" &&
            error !== null &&
            "code" in error &&
            error.code === 11000
          ) {
            return;
          }
          console.error("[ride-incident] Passenger notification failed");
        }
      }),
    );
  } catch {
    console.error("[ride-incident] Notification processing failed");
  }
}
