import { Schema, model, models, Types, type InferSchemaType } from "mongoose";

const PromoCodeSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
      uppercase: true,
      trim: true,
    },
    discountPercentage: { type: Number, required: true, min: 0, max: 100 },
    maxUses: { type: Number, required: false, min: 1, default: null },
    expiresAt: { type: Date, required: false, default: null, index: true },
    usedCount: { type: Number, required: true, default: 0, min: 0 },
    isActive: { type: Boolean, required: true, default: true },
    createdBy: { type: Types.ObjectId, ref: "User", required: false, index: true },
  },
  { timestamps: true, collection: "promo_codes" },
);

PromoCodeSchema.pre("validate", function promoCodeLimitValidation() {
  const hasUsageLimit = typeof this.maxUses === "number" && this.maxUses > 0;
  const hasExpiryLimit = this.expiresAt instanceof Date;

  if (!hasUsageLimit && !hasExpiryLimit) {
    this.invalidate(
      "maxUses",
      "Promo code must have at least one limit: maxUses or expiresAt.",
    );
  }

});

export type PromoCodeDoc = InferSchemaType<typeof PromoCodeSchema>;
export const PromoCode = models.PromoCode || model("PromoCode", PromoCodeSchema);
