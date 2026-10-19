import { Types } from "mongoose";
import { RideIncident } from "@/models/RideIncident";
import { Ride } from "@/models/Ride";
import { Trip } from "@/models/Trip";
import { createNotification } from "@/lib/notifications/createNotification";
import {
  notifyAdminsOfRideIncident,
  notifyAdminsOfRideIncidentWithdrawn,
} from "@/lib/notifications/adminActivity";
import {
  getRideIncidentOutcomeNotificationPayload,
  getRideIncidentPassengerNotificationPayload,
  type RideIncidentOutcome,
} from "@/lib/notifications/rideIncidentPayload";

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

export async function notifyRideIncidentOutcome(input: {
  incidentId: string;
  outcome: RideIncidentOutcome;
  driverId?: string;
  tripIds: string[];
}) {
  try {
    const validTripIds = input.tripIds.filter(Types.ObjectId.isValid);
    const trips = validTripIds.length
      ? await Trip.find({
          _id: { $in: validTripIds },
          status: { $ne: "cancelled" },
        })
          .select("_id userId")
          .lean<{ _id: Types.ObjectId; userId: Types.ObjectId }[]>()
      : [];
    const recipients = new Map<string, string>();
    for (const trip of trips) {
      const userId = String(trip.userId);
      if (!recipients.has(userId)) recipients.set(userId, String(trip._id));
    }

    const notifications: Promise<unknown>[] = [];
    if (input.driverId && Types.ObjectId.isValid(input.driverId)) {
      notifications.push(
        createNotification({
          userId: input.driverId,
          ...getRideIncidentOutcomeNotificationPayload({
            dedupeKey: `${input.incidentId}:${input.outcome}`,
            outcome: input.outcome,
            recipient: "driver",
          }),
        }),
      );
    }
    for (const [userId, tripId] of recipients) {
      notifications.push(
        createNotification({
          userId,
          ...getRideIncidentOutcomeNotificationPayload({
            dedupeKey: `${input.incidentId}:${input.outcome}`,
            outcome: input.outcome,
            tripId,
            recipient: "passenger",
          }),
        }),
      );
    }
    const results = await Promise.allSettled(notifications);
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
        console.error("[ride-incident] Outcome notification failed");
      }
    }
  } catch {
    console.error("[ride-incident] Outcome notification processing failed");
  }
}

export async function notifyRideCancellationPassengers(input: {
  rideId: string;
  tripIds: string[];
}) {
  await notifyRideIncidentOutcome({
    incidentId: `ride:${input.rideId}`,
    outcome: "cancelled",
    tripIds: input.tripIds,
  });
}

export async function notifyRideIncidentWithdrawn(input: {
  incidentId: string;
  rideId: string;
  rideNumber: number;
  driverId: string;
  tripIds: string[];
}) {
  try {
    await Promise.all([
      notifyAdminsOfRideIncidentWithdrawn(input),
      notifyRideIncidentOutcome({
        incidentId: input.incidentId,
        outcome: "continue",
        driverId: input.driverId,
        tripIds: input.tripIds,
      }),
    ]);
  } catch {
    console.error("[ride-incident] Withdrawal notification processing failed");
  }
}
