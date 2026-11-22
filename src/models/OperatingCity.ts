import { Schema, model, models, type InferSchemaType } from "mongoose";

const OperatingCitySchema = new Schema(
  {
    cityCode: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    regionCode: { type: String, required: true, enum: ["EGY", "KSA", "UAE"], index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    nameAr: { type: String, required: true, trim: true, maxlength: 100 },
    isCapital: { type: Boolean, required: true, default: false },
    active: { type: Boolean, required: true, default: true },
    timezone: { type: String, required: true, trim: true },
    mapCenter: {
      lat: { type: Number, required: true, min: -90, max: 90 },
      lng: { type: Number, required: true, min: -180, max: 180 },
    },
    mapZoom: { type: Number, required: true, min: 1, max: 20, default: 11 },
    bounds: {
      minLat: { type: Number, min: -90, max: 90 },
      maxLat: { type: Number, min: -90, max: 90 },
      minLng: { type: Number, min: -180, max: 180 },
      maxLng: { type: Number, min: -180, max: 180 },
    },
    zoneFeatures: { type: [Schema.Types.Mixed], default: [] },
    zoneSourceName: { type: String, default: "", trim: true, maxlength: 160 },
  },
  { timestamps: true },
);

OperatingCitySchema.index({ regionCode: 1, cityCode: 1 }, { unique: true });
OperatingCitySchema.index({ regionCode: 1, active: 1, isCapital: -1, name: 1 });
OperatingCitySchema.index(
  { regionCode: 1, isCapital: 1 },
  { unique: true, partialFilterExpression: { isCapital: true } },
);

export type OperatingCityDoc = InferSchemaType<typeof OperatingCitySchema>;
const existingOperatingCityModel = models.OperatingCity;
if (
  existingOperatingCityModel &&
  !existingOperatingCityModel.schema.path("zoneSourceName")
) {
  existingOperatingCityModel.schema.add({
    zoneSourceName: {
      type: String,
      default: "",
      trim: true,
      maxlength: 160,
    },
  });
}
export const OperatingCity =
  existingOperatingCityModel || model("OperatingCity", OperatingCitySchema);
