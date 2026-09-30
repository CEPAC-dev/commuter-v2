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
    showZones: { type: Boolean, required: true, default: false },
    showZoneLabels: { type: Boolean, required: true, default: false },
    maskOutsideZones: { type: Boolean, required: true, default: false },
  },
  { timestamps: true, collection: "map_settings" },
);

export type MapSettingsDoc = InferSchemaType<typeof MapSettingsSchema>;
export const MapSettingsModel =
  models.MapSettings || model("MapSettings", MapSettingsSchema);
