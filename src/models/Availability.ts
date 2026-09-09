import { Schema, model, models, Types, type InferSchemaType } from "mongoose";
import { PointSchema } from "./Trip"; // reuse the existing address/lat/lng shape

const NearestStationSchema = new Schema(
  {
    id: { type: Number, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    name: { type: String, required: true },
  },
  { _id: false },
);

// Driver's recurring weekly working schedule. A driver may have more than one
// shift on the same day (e.g. a morning and an evening shift). NOT tied to a
// specific calendar date and NOT consumed/removed by a ride.
const AvailabilitySchema = new Schema(
  {
    driverId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    dayOfWeek: {
      type: String,
      required: true,
      enum: ["sun", "mon", "tue", "wed", "thu", "fri", "sat"],
    },
    origin: { type: PointSchema, required: true },
    startNearestStation: {
      type: NearestStationSchema,
      required: false,
      default: null,
    },
    startTime: { type: String, required: true }, // "HH:MM"
    endTime: { type: String, required: true }, // "HH:MM"
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

// Not unique — a driver can have multiple shifts (records) on the same day.
AvailabilitySchema.index({ driverId: 1, dayOfWeek: 1 });

export type AvailabilityDoc = InferSchemaType<typeof AvailabilitySchema>;
export const Availability =
  models.Availability || model("Availability", AvailabilitySchema);

