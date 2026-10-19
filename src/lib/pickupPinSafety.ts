import { Types } from "mongoose";

export function sanitizePickupPinFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizePickupPinFields);
  if (!value || typeof value !== "object") return value;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, nested]) =>
      ["pin", "pickuppin", "pickup_pin"].includes(key.toLowerCase())
        ? []
        : [[key, sanitizePickupPinFields(nested)]],
    ),
  );
}

export function createPickupPinAuditRecord(input: {
  tripId: Types.ObjectId;
  rideId: string;
  userId: Types.ObjectId;
  driverId: string;
  status: string;
  action: "pickup_pin_ok" | "pickup_pin_failed" | "pickup_pin_lockout";
  failedAttempts?: number;
}) {
  return {
    tripId: input.tripId,
    rideId: input.rideId,
    userId: input.userId,
    driverId: input.driverId,
    status: input.status,
    previousStatus: input.status,
    action: input.action,
    description:
      input.action === "pickup_pin_ok"
        ? "Pickup PIN verified."
        : input.action === "pickup_pin_lockout"
          ? "Pickup PIN verification locked after repeated failures."
          : "Pickup PIN verification failed.",
    metadata:
      input.failedAttempts === undefined
        ? {}
        : { failedAttempts: input.failedAttempts },
    actorType: "driver" as const,
    actorId: input.driverId,
  };
}
