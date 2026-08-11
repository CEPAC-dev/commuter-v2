import "server-only";
import { randomBytes } from "crypto";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { isPromoCodeExpired } from "@/lib/promoCodeShared";
import { PromoCode } from "@/models/PromoCode";
import { PromoCodeUsage } from "@/models/PromoCodeUsage";

const PROMO_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_CODE_ATTEMPTS = 10;

export interface PromoCodePreviewResult {
  valid: boolean;
  discountPercentage?: number;
  message: string;
  normalizedCode?: string;
}

export interface PromoCodeApplyResult {
  success: boolean;
  message: string;
  discountPercentage?: number;
  promoCodeId?: string;
  usageId?: string;
  normalizedCode?: string;
}

export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase();
}

export async function generatePromoCode(): Promise<string> {
  await connectDB();

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const bytes = randomBytes(6);
    const suffix = Array.from(
      bytes,
      (byte) => PROMO_ALPHABET[byte % PROMO_ALPHABET.length],
    ).join("");
    const code = `PROMO-${suffix}`;
    const exists = await PromoCode.exists({ code });
    if (!exists) return code;
  }

  throw new Error("Unable to generate a unique promo code");
}

export async function validateAndPreviewPromoCode(
  code: string,
): Promise<PromoCodePreviewResult> {
  await connectDB();

  const normalizedCode = normalizePromoCode(code);
  if (!normalizedCode) {
    return { valid: false, message: "Promo code is required." };
  }

  const promo = await PromoCode.findOne({ code: normalizedCode }).lean<{
    discountPercentage: number;
    maxUses: number | null;
    usedCount: number;
    isActive: boolean;
    expiresAt: Date | null;
  } | null>();
  if (!promo) {
    return { valid: false, message: "Promo code not found." };
  }
  if (!promo.isActive) {
    return { valid: false, message: "Promo code is inactive." };
  }
  if (isPromoCodeExpired(promo.expiresAt)) {
    return { valid: false, message: "This code has expired." };
  }
  if (typeof promo.maxUses === "number" && promo.usedCount >= promo.maxUses) {
    return { valid: false, message: "Promo code is exhausted." };
  }

  return {
    valid: true,
    discountPercentage: promo.discountPercentage,
    message: "Promo code is valid.",
    normalizedCode,
  };
}

export async function applyPromoCodeToTrip(
  code: string,
  userId: string,
  tripId: string,
): Promise<PromoCodeApplyResult> {
  await connectDB();

  if (!Types.ObjectId.isValid(userId) || !Types.ObjectId.isValid(tripId)) {
    return { success: false, message: "Invalid user or trip." };
  }

  const normalizedCode = normalizePromoCode(code);
  if (!normalizedCode) {
    return { success: false, message: "Promo code is required." };
  }

  const promo = await PromoCode.findOneAndUpdate(
    {
      code: normalizedCode,
      isActive: true,
      $and: [
        { $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] },
        { $or: [{ maxUses: null }, { $expr: { $lt: ["$usedCount", "$maxUses"] } }] },
      ],
    },
    { $inc: { usedCount: 1 } },
    {
      returnDocument: "after",
      select: "_id discountPercentage code expiresAt",
    },
  ).lean<{
    _id: Types.ObjectId;
    discountPercentage: number;
    code: string;
    expiresAt: Date | null;
  } | null>();

  if (!promo) {
    return {
      success: false,
      message: "Promo code is invalid, inactive, expired, or exhausted.",
      normalizedCode,
    };
  }

  if (isPromoCodeExpired(promo.expiresAt)) {
    return {
      success: false,
      message: "This code has expired.",
      normalizedCode,
    };
  }

  const usage = await PromoCodeUsage.create({
    promoCode: promo._id,
    user: new Types.ObjectId(userId),
    trip: new Types.ObjectId(tripId),
    discountPercentage: promo.discountPercentage,
  });

  return {
    success: true,
    message: "Promo code applied.",
    discountPercentage: promo.discountPercentage,
    promoCodeId: String(promo._id),
    usageId: String(usage._id),
    normalizedCode: promo.code,
  };
}

export async function rollbackPromoCodeUsage(
  usageId: string,
  promoCodeId: string,
): Promise<void> {
  await connectDB();
  if (!Types.ObjectId.isValid(usageId) || !Types.ObjectId.isValid(promoCodeId)) {
    return;
  }

  await PromoCodeUsage.deleteOne({ _id: usageId });
  await PromoCode.updateOne(
    { _id: promoCodeId, usedCount: { $gt: 0 } },
    { $inc: { usedCount: -1 } },
  );
}
