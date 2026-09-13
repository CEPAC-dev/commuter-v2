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
        "manual_delete",
        "failed",
        "authorization_failed",
      ],
      index: true,
    },
    regionCode: {
      type: String,
      required: true,
      enum: ["EG-CAIRO", "SA", "AE-ABU-DHABI"],
      index: true,
    },
    datasetVersionId: {
      type: Types.ObjectId,
      ref: "StationDataset",
      default: null,
    },
    actorId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

StationAuditLogSchema.index({ regionCode: 1, createdAt: -1 });

export type StationAuditLogDoc = InferSchemaType<typeof StationAuditLogSchema>;
export const StationAuditLog =
  models.StationAuditLog || model("StationAuditLog", StationAuditLogSchema);
