import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const PromoCodeUsageSchema = new Schema(
  {
    promoCode: { type: Types.ObjectId, ref: "PromoCode", required: true, index: true },
    user: { type: Types.ObjectId, ref: "User", required: true, index: true },
    trip: { type: Types.ObjectId, ref: "Trip", required: true, index: true },
    discountType: {
      type: String,
      required: true,
      enum: ["percentage", "fixed"],
      default: "percentage",
    },
    // Snapshot of the promo code's discount value at the time of use.
    discountValue: { type: Number, required: true, min: 0 },
  },
  { timestamps: true, collection: "promo_code_usages" },
);

PromoCodeUsageSchema.index({ promoCode: 1, createdAt: -1 });

export type PromoCodeUsageDoc = InferSchemaType<typeof PromoCodeUsageSchema>;
export const PromoCodeUsage =
  models.PromoCodeUsage || model("PromoCodeUsage", PromoCodeUsageSchema);
