import { Schema, model, models, type InferSchemaType } from "mongoose";

const VehicleRegionConfigSchema = new Schema(
  {
    regionCode: { type: String, required: true },
    rate: { type: Number, required: true },
    additional_rate: { type: Number, required: true, default: 0 },
    buffer: { type: Number, required: true },
    window: { type: Number, required: true },
    capacity: { type: Number, required: true },
    occupancy: { type: Number, required: true },
    min_occupancy: { type: Number, required: true },
    minimum_charge: { type: Number, required: true, default: 0 },
    vehicle_type: { type: Number, required: true, default: 0 },
    trip_type: { type: Number, required: true, default: 0 },
    sortOrder: { type: Number, required: true, default: 0 },
  },
  { _id: false },
);

const VehicleSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      match: /^[a-z][a-z0-9_]{1,63}$/,
    },
    label: { type: String, required: true },
    rate: { type: Number, required: true }, // EGP per km
    additional_rate: { type: Number, required: true, default: 0 },
    ride: { type: String, required: true, enum: ["private", "shared"] },
    buffer: { type: Number, required: true }, // minutes subtracted before pickup window
    window: { type: Number, required: true }, // width of pickup window in minutes
    capacity: { type: Number, required: true },
    occupancy: { type: Number, required: true, default: 0 },
    min_occupancy: { type: Number, required: true },
    minimum_charge: { type: Number, required: true, default: 0 },
    vehicle_type: { type: Number, required: true, default: 0 },
    trip_type: { type: Number, required: true, default: 0 },
    regionCodes: { type: [String], required: true, default: [] },
    regionConfigs: { type: [VehicleRegionConfigSchema], required: true, default: [] },
    sortOrder: { type: Number, required: true, default: 0 },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

export type VehicleDoc = InferSchemaType<typeof VehicleSchema>;
export const Vehicle = models.Vehicle || model("Vehicle", VehicleSchema);
