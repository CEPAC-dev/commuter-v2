import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

export const LogSchema = new Schema(
  {
    tripId: {
      type: Types.ObjectId,
      ref: "Trip",
      required: true,
      index: true,
    },
    rideId: {
      type: Types.ObjectId,
      ref: "Ride",
      required: false,
      index: true,
      default: null,
    },
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    driverId: {
      type: Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
      default: null,
    },
    // The new status after this log event
    status: {
      type: String,
      required: true,
      enum: [
        "pending_payment",
        "submitted",
        "matched",
        "confirmed",
        "active",
        "completed",
        "cancelled",
        "time_out",
      ],
    },
    // Previous status before this change
    previousStatus: {
      type: String,
      required: false,
      enum: [
        "pending_payment",
        "submitted",
        "matched",
        "confirmed",
        "active",
        "completed",
        "cancelled",
        "time_out",
      ],
      default: null,
    },
    // The action that triggered this log
    action: {
      type: String,
      required: true,
      enum: [
        "created",
        "payment_initiated",
        "payment_completed",
        "payment_failed",
        "matched",
        "driver_accepted",
        "driver_rejected",
        "driver_cancelled",
        "confirmed",
        "ride_started",
        "station_arrived",
        "pickup_arrived",
        "passenger_picked_up",
        "no_show",
        "stop_point_arrived",
        "boarding_alighting",
        "ride_completed",
        "trip_started",
        "trip_completed",
        "trip_cancelled",
        "system_timeout",
        "user_cancelled",
        "system_cancelled",
        "trip_modified",
        "status_changed",
        "custom_action",
      ],
    },
    // Human-readable description of what happened
    description: {
      type: String,
      required: true,
    },
    // For shared rides: which station in the route
    stationIndex: {
      type: Number,
      required: false,
      default: null,
      min: 0,
    },
    // Station name for display
    stationName: {
      type: String,
      required: false,
      default: null,
    },
    // For station stops: number of passengers boarding
    boardingCount: {
      type: Number,
      required: false,
      default: null,
      min: 0,
    },
    // For station stops: number of passengers alighting
    alightingCount: {
      type: Number,
      required: false,
      default: null,
      min: 0,
    },
    // Explicit timestamp of the action (e.g., when driver pressed button)
    actionTimestamp: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    // Additional metadata (flexible structure)
    metadata: {
      type: Schema.Types.Mixed,
      required: false,
      default: {},
    },
    // Who or what triggered this action (system, user, driver, admin)
    actorType: {
      type: String,
      required: true,
      enum: ["system", "user", "driver", "admin"],
      default: "system",
    },
    // Actor ID (could be userId, driverId, or admin ID)
    actorId: {
      type: Types.ObjectId,
      required: false,
      default: null,
    },
  },
  {
    timestamps: true,
    collection: "logs",
  },
);

// Indexes for efficient queries
LogSchema.index({ tripId: 1, createdAt: -1 });
LogSchema.index({ userId: 1, createdAt: -1 });
LogSchema.index({ driverId: 1, createdAt: -1 });
LogSchema.index({ action: 1, createdAt: -1 });
LogSchema.index({ createdAt: -1 });

export type LogDoc = InferSchemaType<typeof LogSchema>;
export const Log = models.Log || model("Log", LogSchema);
