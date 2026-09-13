import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const ValidationIssueSchema = new Schema(
  {
    row: { type: Number, required: false },
    field: { type: String, required: true },
    code: { type: String, required: true },
    message: { type: String, required: true },
  },
  { _id: false },
);

const DatasetStationSchema = new Schema(
  {
    objectId: { type: Number, required: true },
    name: { type: String, required: true },
    direction: { type: String, default: "" },
    zones: { type: String, default: "" },
    description: { type: String, default: "" },
    landmark: { type: String, default: "" },
    stationType: { type: String, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false },
);

const StationDatasetSchema = new Schema(
  {
    regionCode: {
      type: String,
      required: true,
      enum: ["EG-CAIRO", "SA", "AE-ABU-DHABI"],
      index: true,
    },
    version: { type: Number, required: true, min: 1 },
    status: {
      type: String,
      required: true,
      enum: [
        "UPLOADED",
        "VALIDATING",
        "VALID",
        "INVALID",
        "PUBLISHED",
        "ARCHIVED",
      ],
      default: "UPLOADED",
      index: true,
    },
    file: {
      originalName: { type: String, required: true },
      contentType: { type: String, required: true },
      size: { type: Number, required: true, min: 1 },
      checksumSha256: { type: String, required: true },
      storageKey: { type: String, required: true },
    },
    uploadedBy: { type: Types.ObjectId, ref: "User", required: true },
    uploadedAt: { type: Date, required: true, default: () => new Date() },
    validatedAt: { type: Date, default: null },
    publishedAt: { type: Date, default: null },
    publishedBy: { type: Types.ObjectId, ref: "User", default: null },
    stationCount: { type: Number, required: true, default: 0, min: 0 },
    validCount: { type: Number, required: true, default: 0, min: 0 },
    invalidCount: { type: Number, required: true, default: 0, min: 0 },
    newCount: { type: Number, required: true, default: 0, min: 0 },
    updatedCount: { type: Number, required: true, default: 0, min: 0 },
    removedCount: { type: Number, required: true, default: 0, min: 0 },
    unchangedCount: { type: Number, required: true, default: 0, min: 0 },
    errors: { type: [ValidationIssueSchema], default: [] },
    warnings: { type: [ValidationIssueSchema], default: [] },
    normalizedStations: {
      type: [DatasetStationSchema],
      default: [],
      select: false,
    },
  },
  { timestamps: true },
);

StationDatasetSchema.index({ regionCode: 1, version: 1 }, { unique: true });
StationDatasetSchema.index({ regionCode: 1, createdAt: -1 });

export type StationDatasetDoc = InferSchemaType<typeof StationDatasetSchema>;
export const StationDataset =
  models.StationDataset || model("StationDataset", StationDatasetSchema);
