import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const RideIncidentSchema = new Schema(
  {
    rideId: { type: Types.ObjectId, ref: "Ride", required: true, index: true },
    driverId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: [
        "vehicle_breakdown",
        "accident",
        "emergency",
        "passenger_issue",
        "other",
      ],
    },
    note: { type: String, required: false, maxlength: 300, trim: true },
    rideStatusAtReport: {
      type: String,
      required: true,
      enum: ["confirmed", "active"],
    },
    affectedTripIds: {
      type: [Types.ObjectId],
      ref: "Trip",
      required: true,
      default: [],
    },
    needsFollowUpTripIds: {
      type: [Types.ObjectId],
      ref: "Trip",
      required: true,
      default: [],
    },
    status: {
      type: String,
      required: true,
      enum: ["open", "resolved"],
      default: "open",
      index: true,
    },
    resolution: { type: String, default: null, maxlength: 1000 },
    adminNote: { type: String, default: null, maxlength: 1000 },
    resolvedBy: { type: Types.ObjectId, ref: "User", default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "ride_incidents" },
);

RideIncidentSchema.index(
  { rideId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "open" },
    name: "ride_one_open_incident",
  },
);

export type RideIncidentDoc = InferSchemaType<typeof RideIncidentSchema>;
export const RideIncident =
  models.RideIncident || model("RideIncident", RideIncidentSchema);
