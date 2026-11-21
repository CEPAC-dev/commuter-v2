import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const ZoneDatasetSchema = new Schema(
  {
    regionCode: {
      type: String,
      required: true,
      unique: true,
      enum: ["EGY", "KSA", "UAE"],
    },
    sourceName: { type: String, required: true, maxlength: 160 },
    features: { type: [Schema.Types.Mixed], required: true, default: [] },
    featureCount: { type: Number, required: true, min: 1 },
    updatedBy: { type: Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true, collection: "zone_datasets" },
);

export type ZoneDatasetDoc = InferSchemaType<typeof ZoneDatasetSchema>;
export const ZoneDataset =
  models.ZoneDataset || model("ZoneDataset", ZoneDatasetSchema);
