/**
 * Log Action Helpers
 * Pre-built functions for common logging scenarios used by actions
 */

import { createLog } from "@/lib/services/logService";
import type { Types } from "mongoose";

/**
 * Log when payment is initiated
 */
export async function logPaymentInitiated(
  tripId: Types.ObjectId | string,
  userId: Types.ObjectId | string,
  metadata?: Record<string, unknown>,
) {
  return await createLog({
    tripId,
    userId,
    status: "submitted",
    previousStatus: "pending_payment",
    action: "payment_initiated",
    description: "Payment session initiated",
    metadata,
    actorType: "system",
  });
}

/**
 * Log when payment is completed
 */
export async function logPaymentCompleted(
  tripId: Types.ObjectId | string,
  userId: Types.ObjectId | string,
  metadata?: Record<string, unknown>,
) {
  return await createLog({
    tripId,
    userId,
    status: "submitted",
    previousStatus: "submitted",
    action: "payment_completed",
    description: "Payment completed successfully",
    metadata,
    actorType: "system",
  });
}

/**
 * Log when payment fails
 */
export async function logPaymentFailed(
  tripId: Types.ObjectId | string,
  userId: Types.ObjectId | string,
  reason?: string,
  metadata?: Record<string, unknown>,
) {
  return await createLog({
    tripId,
    userId,
    status: "pending_payment",
    previousStatus: "submitted",
    action: "payment_failed",
    description: `Payment failed${reason ? `: ${reason}` : ""}`,
    metadata,
    actorType: "system",
  });
}

/**
 * Log when driver accepts a trip
 */
export async function logDriverAccepted(
  tripId: Types.ObjectId | string,
  userId: Types.ObjectId | string,
  driverId: Types.ObjectId | string,
  metadata?: Record<string, unknown>,
) {
  return await createLog({
    tripId,
    userId,
    driverId,
    status: "confirmed",
    previousStatus: "matched",
    action: "driver_accepted",
    description: "Driver accepted the trip",
    metadata,
    actorType: "driver",
    actorId: driverId,
  });
}

/**
 * Log when driver rejects a trip
 */
export async function logDriverRejected(
  tripId: Types.ObjectId | string,
  userId: Types.ObjectId | string,
  driverId: Types.ObjectId | string,
  reason?: string,
  metadata?: Record<string, unknown>,
) {
  return await createLog({
    tripId,
    userId,
    driverId,
    status: "matched",
    previousStatus: "matched",
    action: "driver_rejected",
    description: `Driver rejected the trip${reason ? `: ${reason}` : ""}`,
    metadata,
    actorType: "driver",
    actorId: driverId,
  });
}

/**
 * Log when driver cancels a trip
 */
export async function logDriverCancelled(
  tripId: Types.ObjectId | string,
  userId: Types.ObjectId | string,
  driverId: Types.ObjectId | string,
  reason?: string,
  metadata?: Record<string, unknown>,
) {
  return await createLog({
    tripId,
    userId,
    driverId,
    status: "cancelled",
    previousStatus: "confirmed",
    action: "driver_cancelled",
    description: `Driver cancelled the trip${reason ? `: ${reason}` : ""}`,
    metadata,
    actorType: "driver",
    actorId: driverId,
  });
}

/**
 * Log when user cancels a trip
 */
export async function logUserCancelled(
  tripId: Types.ObjectId | string,
  userId: Types.ObjectId | string,
  reason?: string,
  metadata?: Record<string, unknown>,
) {
  return await createLog({
    tripId,
    userId,
    status: "cancelled",
    previousStatus: "confirmed",
    action: "user_cancelled",
    description: `User cancelled the trip${reason ? `: ${reason}` : ""}`,
    metadata,
    actorType: "user",
    actorId: userId,
  });
}

/**
 * Log when trip is matched with a driver
 */
export async function logTripMatched(
  tripId: Types.ObjectId | string,
  userId: Types.ObjectId | string,
  driverId: Types.ObjectId | string,
  metadata?: Record<string, unknown>,
) {
  return await createLog({
    tripId,
    userId,
    driverId,
    status: "matched",
    previousStatus: "submitted",
    action: "matched",
    description: "Trip matched with driver",
    metadata,
    actorType: "system",
  });
}

/**
 * Log when trip starts
 */
export async function logTripStarted(
  tripId: Types.ObjectId | string,
  userId: Types.ObjectId | string,
  driverId: Types.ObjectId | string,
  metadata?: Record<string, unknown>,
) {
  return await createLog({
    tripId,
    userId,
    driverId,
    status: "active",
    previousStatus: "confirmed",
    action: "trip_started",
    description: "Trip started - driver is on the way",
    metadata,
    actorType: "driver",
    actorId: driverId,
  });
}

/**
 * Log when trip completes
 */
export async function logTripCompleted(
  tripId: Types.ObjectId | string,
  userId: Types.ObjectId | string,
  driverId: Types.ObjectId | string,
  metadata?: Record<string, unknown>,
) {
  return await createLog({
    tripId,
    userId,
    driverId,
    status: "completed",
    previousStatus: "active",
    action: "trip_completed",
    description: "Trip completed successfully",
    metadata,
    actorType: "system",
  });
}

/**
 * Log when trip times out
 */
export async function logTripTimeout(
  tripId: Types.ObjectId | string,
  userId: Types.ObjectId | string,
  metadata?: Record<string, unknown>,
) {
  return await createLog({
    tripId,
    userId,
    status: "time_out",
    previousStatus: "submitted",
    action: "system_timeout",
    description: "Trip timed out - no driver matched",
    metadata,
    actorType: "system",
  });
}

/**
 * Log when trip is created
 */
export async function logTripCreated(
  tripId: Types.ObjectId | string,
  userId: Types.ObjectId | string,
  metadata?: Record<string, unknown>,
) {
  return await createLog({
    tripId,
    userId,
    status: "pending_payment",
    action: "created",
    description: "Trip created and awaiting payment",
    metadata,
    actorType: "user",
    actorId: userId,
  });
}

/**
 * Log custom action
 */
export async function logCustomAction(
  tripId: Types.ObjectId | string,
  userId: Types.ObjectId | string,
  action: string,
  description: string,
  status?: string,
  previousStatus?: string | null,
  driverId?: Types.ObjectId | string | null,
  actorType?: "system" | "user" | "driver" | "admin",
  actorId?: Types.ObjectId | string | null,
  metadata?: Record<string, unknown>,
) {
  return await createLog({
    tripId,
    userId,
    driverId: driverId || null,
    status: status || "submitted",
    previousStatus: previousStatus || null,
    action: action === "custom_action" ? "custom_action" : action,
    description,
    metadata,
    actorType: actorType || "system",
    actorId: actorId || null,
  });
}
