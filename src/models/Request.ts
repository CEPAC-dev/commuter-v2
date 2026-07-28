import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const RequestSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    dates: {
      type: [String],
      required: true,
      validate: {
        validator: (value: unknown[]) =>
          Array.isArray(value) && value.length > 0,
        message: "Request must contain at least one date",
      },
    },
    amountEgp: { type: Number, required: true },
    note: { type: String, default: "", trim: true, maxlength: 1000 },
    paymentStatus: {
      type: String,
      required: true,
      default: "pending",
      enum: ["pending", "paid", "failed", "refunded", "expired"],
    },
    kashierSessionId: { type: String },
    kashierOrderId: { type: String },
    paidAt: { type: Date },
    status: {
      type: String,
      required: true,
      default: "pending_payment",
      enum: [
        "pending_payment",
        "submitted",
        "matched",
        "confirmed",
        "active",
        "completed",
        "cancelled",
        "time_out",
      ],
    },
  },
  { timestamps: true, collection: "requests" },
);

export type RequestDoc = InferSchemaType<typeof RequestSchema>;
export const Request = models.Request || model("Request", RequestSchema);
