import { Schema, model, models, Types } from "mongoose";

/** Manual changes layered over the immutable dataset source projection. */
const StationOverrideSchema = new Schema(
  {
    regionCode: { type: String, required: true, enum: ["EG-CAIRO", "SA", "AE-ABU-DHABI"], index: true },
    stationId: { type: Types.ObjectId, ref: "Station", required: true },
    objectId: { type: Number, required: true },
    fields: { type: Schema.Types.Mixed, required: true, default: {} },
    actorId: { type: Types.ObjectId, ref: "User", required: true },
    reason: { type: String, default: "", maxlength: 500 },
    sourceRemoved: { type: Boolean, default: false },
  },
  { timestamps: true },
);
StationOverrideSchema.index({ regionCode: 1, objectId: 1 }, { unique: true });
StationOverrideSchema.index({ regionCode: 1, stationId: 1 }, { unique: true });
export const StationOverride = models.StationOverride || model("StationOverride", StationOverrideSchema);
