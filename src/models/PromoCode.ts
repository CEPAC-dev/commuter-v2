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
    discountType: {
      type: String,
      required: true,
      enum: ["percentage", "fixed"],
      default: "percentage",
    },
    // Percentage (0-100) when discountType is "percentage", flat EGP amount when "fixed".
    discountValue: { type: Number, required: true, min: 0 },
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

  if (this.discountType === "percentage") {
    if (
      typeof this.discountValue !== "number" ||
      this.discountValue < 0 ||
      this.discountValue > 100
    ) {
      this.invalidate(
        "discountValue",
        "Percentage discount value must be between 0 and 100.",
      );
    }
  } else if (this.discountType === "fixed") {
    if (typeof this.discountValue !== "number" || this.discountValue <= 0) {
      this.invalidate(
        "discountValue",
        "Fixed discount value must be a positive number.",
      );
    }
  }
});

export type PromoCodeDoc = InferSchemaType<typeof PromoCodeSchema>;
export const PromoCode = models.PromoCode || model("PromoCode", PromoCodeSchema);
