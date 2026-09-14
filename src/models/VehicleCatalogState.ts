import { Schema, model, models } from "mongoose";

const VehicleCatalogStateSchema = new Schema({
  key: { type: String, required: true, unique: true },
}, { timestamps: true });

export const VehicleCatalogState = models.VehicleCatalogState || model("VehicleCatalogState", VehicleCatalogStateSchema);
