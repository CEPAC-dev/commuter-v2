import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const StationAuditLogSchema = new Schema(
  {
    action: {
      type: String,
      required: true,
      enum: [
        "upload",
        "validate",
        "preview",
        "publish",
        "rollback",
        "manual_create",
        "manual_update",
        "manual_deactivate",
        "manual_reactivate",
        "manual_delete",
        "download",
        "failed",
        "authorization_failed",
      ],
      index: true,
    },
    regionCode: {
      type: String,
      required: true,
      enum: ["EGY", "KSA", "UAE"],
      index: true,
    },
    cityCode: { type: String, required: false, trim: true, lowercase: true, index: true },
    datasetVersionId: {
      type: Types.ObjectId,
      ref: "StationDataset",
      default: null,
    },
    stationId: { type: Types.ObjectId, ref: "Station", default: null },
    actorId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

StationAuditLogSchema.index({ regionCode: 1, cityCode: 1, createdAt: -1 });

export type StationAuditLogDoc = InferSchemaType<typeof StationAuditLogSchema>;
export const StationAuditLog =
  models.StationAuditLog || model("StationAuditLog", StationAuditLogSchema);
