import { Schema, model, models, Types, type InferSchemaType } from "mongoose";
import {
  TRIP_SHARE_ACTIVE_INDEX,
  TRIP_SHARE_DELETE_AT_INDEX,
} from "@/lib/liveShare/indexes";

const LastLocationSchema = new Schema(
  {
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    accuracy: { type: Number, required: false, min: 0, max: 1_000 },
    heading: { type: Number, required: false, min: 0, max: 360 },
    speed: { type: Number, required: false, min: 0 },
    recordedAt: { type: Date, required: true },
    receivedAt: { type: Date, required: true },
  },
  { _id: false },
);

const TripShareSchema = new Schema(
  {
    tripId: { type: Types.ObjectId, ref: "Trip", required: true },
    rideId: { type: Types.ObjectId, ref: "Ride", default: null },
    userId: { type: Types.ObjectId, ref: "User", required: true },
    active: { type: Boolean, required: true, default: true },
    consentAt: { type: Date, required: true },
    consentVersion: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    lastLocation: { type: LastLocationSchema, default: undefined },
    viewCount: { type: Number, required: true, default: 0, min: 0 },
    lastViewedAt: { type: Date, default: null },
    deleteAt: { type: Date, required: true },
  },
  { timestamps: true, collection: "tripshares" },
);

TripShareSchema.index(
  TRIP_SHARE_ACTIVE_INDEX.keys,
  TRIP_SHARE_ACTIVE_INDEX.options,
);
TripShareSchema.index(
  TRIP_SHARE_DELETE_AT_INDEX.keys,
  TRIP_SHARE_DELETE_AT_INDEX.options,
);

export type TripShareDoc = InferSchemaType<typeof TripShareSchema>;
export const TripShare =
  models.TripShare || model("TripShare", TripShareSchema);
