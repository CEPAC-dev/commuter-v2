import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const DriverLocationSchema = new Schema(
  {
    subjectType: {
      type: String,
      required: true,
      enum: ["ride", "trip"],
    },
    subjectId: { type: Types.ObjectId, required: true },
    driverId: { type: Types.ObjectId, ref: "User", required: true },
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
    accuracy: { type: Number, required: false, min: 0, max: 1_000 },
    heading: { type: Number, required: false, min: 0, max: 360 },
    speed: { type: Number, required: false, min: 0 },
    recordedAt: { type: Date, required: true },
    receivedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: false, collection: "driverlocations" },
);

DriverLocationSchema.index(
  { subjectType: 1, subjectId: 1 },
  { unique: true },
);
DriverLocationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type DriverLocationDoc = InferSchemaType<typeof DriverLocationSchema>;
export const DriverLocation =
  models.DriverLocation || model("DriverLocation", DriverLocationSchema);
