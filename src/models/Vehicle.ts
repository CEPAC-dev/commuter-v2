import { Schema, model, models, type InferSchemaType } from "mongoose";

const VehicleSchema = new Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      enum: [
        "private_car",
        "taxi_private",
        "taxi_shared",
        "van_shared",
        "microbus_shared",
      ],
    },
    label: { type: String, required: true },
    rate: { type: Number, required: true }, // EGP per km
    ride: { type: String, required: true, enum: ["private", "shared"] },
    buffer: { type: Number, required: true }, // minutes subtracted before pickup window
    window: { type: Number, required: true }, // width of pickup window in minutes
    capacity: { type: Number, required: true },
    occupancy: { type: Number, required: true, default: 0 },
    min_occupancy: { type: Number, required: true },
    minimum_charge: { type: Number, required: true, default: 0 },
    sortOrder: { type: Number, required: true, default: 0 },
    active: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

export type VehicleDoc = InferSchemaType<typeof VehicleSchema>;
export const Vehicle = models.Vehicle || model("Vehicle", VehicleSchema);
