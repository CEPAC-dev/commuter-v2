import { Schema, model, models, Types } from "mongoose";

/** One document per City/State; also provides a durable compare-and-set publish lock. */
const StationRegionStateSchema = new Schema(
  {
    regionCode: { type: String, required: true, enum: ["EG-CAIRO", "SA", "AE-ABU-DHABI"] },
    cityCode: { type: String, required: true, trim: true, lowercase: true },
    activeDatasetVersionId: { type: Types.ObjectId, ref: "StationDataset", default: null },
    publishingDatasetVersionId: { type: Types.ObjectId, ref: "StationDataset", default: null },
    lockAcquiredAt: { type: Date, default: null },
  },
  { timestamps: true },
);
StationRegionStateSchema.index(
  { regionCode: 1, cityCode: 1 },
  { unique: true },
);
export const StationRegionState = models.StationRegionState || model("StationRegionState", StationRegionStateSchema);
