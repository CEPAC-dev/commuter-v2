import { Schema, model, models, type InferSchemaType } from "mongoose";

const MapSettingsSchema = new Schema(
  {
    regionCode: {
      type: String,
      required: true,
      unique: true,
      enum: ["EG-CAIRO", "SA", "AE-ABU-DHABI"],
    },
    provider: { type: String, required: true, enum: ["google", "osm"] },
    canvasStyle: {
      type: String,
      required: true,
      enum: ["roadmap", "satellite", "light"],
      default: "roadmap",
    },
    osmTheme: {
      type: String,
      required: true,
      enum: ["default", "app", "midnight", "forest"],
      default: "app",
    },
    showStations: { type: Boolean, required: true, default: true },
    stationAssignmentMode: {
      type: String,
      required: true,
      enum: ["shared-vehicles", "zones"],
      default: "shared-vehicles",
    },
    directPointZoneIds: { type: [String], required: true, default: [] },
    stationZoneIds: { type: [String], required: true, default: [] },
    showZones: { type: Boolean, required: true, default: false },
    showZoneLabels: { type: Boolean, required: true, default: false },
    maskOutsideZones: { type: Boolean, required: true, default: false },
  },
  { timestamps: true, collection: "map_settings" },
);

export type MapSettingsDoc = InferSchemaType<typeof MapSettingsSchema>;
export const MapSettingsModel =
  models.MapSettings || model("MapSettings", MapSettingsSchema);
