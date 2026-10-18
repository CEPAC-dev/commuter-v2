import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const LocationSnapshotSchema = new Schema(
  {
    address: { type: String, required: true, trim: true, maxlength: 300 },
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
  },
  { _id: false },
);

const SuggestedPointSchema = new Schema(
  {
    lat: { type: Number, required: true, min: -90, max: 90 },
    lng: { type: Number, required: true, min: -180, max: 180 },
  },
  { _id: false },
);

const StationSuggestionSchema = new Schema(
  {
    requestNumber: { type: Number, required: true, unique: true, index: true },
    requesterId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    requester: {
      userNumber: { type: Number, required: true },
      name: { type: String, required: true, trim: true, maxlength: 100 },
      email: { type: String, default: "", trim: true, maxlength: 254 },
      phone: { type: String, required: true, trim: true, maxlength: 20 },
    },
    regionCode: {
      type: String,
      required: true,
      enum: ["EG-CAIRO", "SA", "AE-ABU-DHABI"],
      index: true,
    },
    locationType: {
      type: String,
      required: true,
      enum: ["pickup", "dropoff"],
    },
    targetLocation: { type: LocationSnapshotSchema, required: true },
    suggestedPoint: { type: SuggestedPointSchema, required: true },
    zoneName: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, required: true, trim: true, maxlength: 500 },
    status: {
      type: String,
      required: true,
      default: "pending",
      enum: ["pending", "processing", "approved", "rejected"],
      index: true,
    },
    reviewedBy: { type: Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: "", trim: true, maxlength: 500 },
    stationId: { type: Types.ObjectId, ref: "Station", default: null },
  },
  { timestamps: true },
);

StationSuggestionSchema.index({ createdAt: -1 });
StationSuggestionSchema.index({
  "requester.name": 1,
  "requester.email": 1,
  description: 1,
});

export type StationSuggestionDoc = InferSchemaType<
  typeof StationSuggestionSchema
>;

export const StationSuggestion =
  models.StationSuggestion ||
  model("StationSuggestion", StationSuggestionSchema);
