import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

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
    // Optional until all legacy stations are backfilled and queries migrate.
    regionCode: {
      type: String,
      required: false,
      enum: ["EG-CAIRO", "SA", "AE-ABU-DHABI"],
    },
    datasetVersionId: {
      type: Types.ObjectId,
      ref: "StationDataset",
      required: false,
      default: null,
    },
    sourceObjectId: { type: Number, required: false, default: null },
  },
  { timestamps: true },
);

StationSchema.index({ objectId: 1 }, { unique: true });
StationSchema.index({ lat: 1, lng: 1 });

export type StationDoc = InferSchemaType<typeof StationSchema>;
const existingStationModel = models.Station;
if (existingStationModel && !existingStationModel.schema.path("regionCode")) {
  existingStationModel.schema.add({
    regionCode: {
      type: String,
      required: false,
      enum: ["EG-CAIRO", "SA", "AE-ABU-DHABI"],
    },
    datasetVersionId: {
      type: Types.ObjectId,
      ref: "StationDataset",
      required: false,
      default: null,
    },
    sourceObjectId: { type: Number, required: false, default: null },
  });
}
export const Station = existingStationModel || model("Station", StationSchema);
