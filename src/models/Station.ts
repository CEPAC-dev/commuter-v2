import { Schema, model, models, type InferSchemaType } from "mongoose";

const StationSchema = new Schema(
  {
    objectId: { type: Number, required: true }, // source OBJECTID / feature id
    name: { type: String, default: "", trim: true },
    direction: { type: String, default: "", trim: true },
    zones: { type: String, default: "", trim: true },
    description: { type: String, default: "", trim: true },
    landmark: { type: String, default: "", trim: true },
    stationType: { type: String, default: "", trim: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true },
);

StationSchema.index({ objectId: 1 }, { unique: true });
StationSchema.index({ lat: 1, lng: 1 });

export type StationDoc = InferSchemaType<typeof StationSchema>;
export const Station = models.Station || model("Station", StationSchema);
