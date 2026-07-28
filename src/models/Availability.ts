import { Schema, model, models, Types, type InferSchemaType } from "mongoose";
import { PointSchema, StationSchema } from "./Trip"; // extract these from Trip.ts

const AvailabilitySchema = new Schema(
  {
    availabilityNumber: {
      type: Number,
      required: true,
      unique: true,
      sparse: true,
      immutable: true,
    },
    driverId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    startLocation: { type: PointSchema, required: true },
    endLocation: { type: PointSchema, required: true },
    startNearestStation: { type: StationSchema, required: false },
    endNearestStation: { type: StationSchema, required: false },
    startTime: { type: String, required: true }, // "HH:MM"
    endTime: { type: String, required: true }, // "HH:MM"
    // seatsRemaining: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      required: true,
      default: "open",
      enum: ["open", "matched", "full", "closed", "cancelled"],
    },
    rideId: {
      type: Types.ObjectId,
      ref: "Ride",
      required: false,
      index: true,
      default: null,
    },
  },
  { timestamps: true },
);

export type AvailabilityDoc = InferSchemaType<typeof AvailabilitySchema>;
export const Availability =
  models.Availability || model("Availability", AvailabilitySchema);
