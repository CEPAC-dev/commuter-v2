import { Schema, model, models, Types } from "mongoose";

/** One document per region; also provides a durable compare-and-set publish lock. */
const StationRegionStateSchema = new Schema(
  {
    regionCode: { type: String, required: true, unique: true, enum: ["EG-CAIRO", "SA", "AE-ABU-DHABI"] },
    activeDatasetVersionId: { type: Types.ObjectId, ref: "StationDataset", default: null },
    publishingDatasetVersionId: { type: Types.ObjectId, ref: "StationDataset", default: null },
    lockAcquiredAt: { type: Date, default: null },
  },
  { timestamps: true },
);
export const StationRegionState = models.StationRegionState || model("StationRegionState", StationRegionStateSchema);
