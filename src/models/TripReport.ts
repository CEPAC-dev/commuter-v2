import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const TripReportSchema = new Schema(
  {
    tripId: {
      type: Types.ObjectId,
      ref: "Trip",
      required: true,
      index: true,
    },
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    driverId: {
      type: Types.ObjectId,
      ref: "User",
      required: false,
      index: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "vehicle_condition",
        "driver_behavior",
        "route_issue",
        "safety_concern",
        "pricing_issue",
        "cleanliness",
        "other",
      ],
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    status: {
      type: String,
      required: true,
      enum: ["open", "under_review", "resolved", "dismissed"],
      default: "open",
      index: true,
    },
    adminNote: {
      type: String,
      required: false,
      maxlength: 1000,
      trim: true,
    },
    reviewedBy: {
      type: Types.ObjectId,
      ref: "User",
      required: false,
    },
    reviewedAt: {
      type: Date,
      required: false,
    },
  },
  { timestamps: true, collection: "trip_reports" },
);

TripReportSchema.index({ tripId: 1, userId: 1 });
TripReportSchema.index({ status: 1, createdAt: -1 });

export type TripReportDoc = InferSchemaType<typeof TripReportSchema>;
export const TripReport =
  models.TripReport || model("TripReport", TripReportSchema);
