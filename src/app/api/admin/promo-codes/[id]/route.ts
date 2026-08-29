import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import {
  computePromoExpiryFromDuration,
  hasPromoLimitingFactor,
} from "@/lib/promoCodeShared";
import { PromoCode } from "@/models/PromoCode";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { error: "Invalid promo code id." },
      { status: 400 },
    );
  }

  let body: {
    isActive?: boolean;
    discountType?: string;
    discountValue?: number;
    maxUses?: number;
    unlimitedUses?: boolean;
    expiryDays?: number;
    expiryHours?: number;
    expiryMinutes?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  await connectDB();

  const existing = await PromoCode.findById(id)
    .select("maxUses expiresAt discountType discountValue")
    .lean<{
      maxUses: number | null;
      expiresAt: Date | null;
      discountType: "percentage" | "fixed";
      discountValue: number;
    } | null>();

  if (!existing) {
    return NextResponse.json(
      { error: "Promo code not found." },
      { status: 404 },
    );
  }

  const update: Record<string, unknown> = {};
  if (typeof body.isActive === "boolean") {
    update.isActive = body.isActive;
  }

  if (body.discountType !== undefined || body.discountValue !== undefined) {
    const nextDiscountType: "percentage" | "fixed" =
      body.discountType === "fixed" || body.discountType === "percentage"
        ? body.discountType
        : existing.discountType;
    const nextDiscountValue =
      body.discountValue !== undefined
        ? Number(body.discountValue)
        : existing.discountValue;

    if (!Number.isFinite(nextDiscountValue)) {
      return NextResponse.json(
        { error: "Discount value is required." },
        { status: 400 },
      );
    }
    if (
      nextDiscountType === "percentage" &&
      (nextDiscountValue < 0 || nextDiscountValue > 100)
    ) {
      return NextResponse.json(
        { error: "Discount percentage must be between 0 and 100." },
        { status: 400 },
      );
    }
    if (nextDiscountType === "fixed" && nextDiscountValue <= 0) {
      return NextResponse.json(
        { error: "Fixed discount amount must be a positive number." },
        { status: 400 },
      );
    }

    update.discountType = nextDiscountType;
    update.discountValue = nextDiscountValue;
  }
  if (body.maxUses !== undefined && body.unlimitedUses !== true) {
    const maxUses = Number(body.maxUses);
    if (!Number.isInteger(maxUses) || maxUses < 1) {
      return NextResponse.json(
        { error: "Maximum uses must be an integer of at least 1." },
        { status: 400 },
      );
    }
    update.maxUses = maxUses;
  }

  const hasDurationInput =
    body.expiryDays !== undefined ||
    body.expiryHours !== undefined ||
    body.expiryMinutes !== undefined;

  let computedExpiresAt: Date | null = existing.expiresAt;
  if (hasDurationInput) {
    const expiryDays = Number(body.expiryDays ?? 0);
    const expiryHours = Number(body.expiryHours ?? 0);
    const expiryMinutes = Number(body.expiryMinutes ?? 0);

    if (
      !Number.isInteger(expiryDays) ||
      !Number.isInteger(expiryHours) ||
      !Number.isInteger(expiryMinutes) ||
      expiryDays < 0 ||
      expiryHours < 0 ||
      expiryMinutes < 0
    ) {
      return NextResponse.json(
        { error: "Expiry duration values must be non-negative integers." },
        { status: 400 },
      );
    }

    computedExpiresAt = computePromoExpiryFromDuration({
      days: expiryDays,
      hours: expiryHours,
      minutes: expiryMinutes,
    });
    update.expiresAt = computedExpiresAt;
  }

  const unlimitedUsesProvided = typeof body.unlimitedUses === "boolean";
  let mergedMaxUses: number | null = existing.maxUses;
  if (unlimitedUsesProvided && body.unlimitedUses === true) {
    mergedMaxUses = null;
    update.maxUses = null;
  } else if (unlimitedUsesProvided && body.unlimitedUses === false) {
    if (body.maxUses !== undefined) {
      mergedMaxUses = Number(body.maxUses);
      update.maxUses = mergedMaxUses;
    } else if (typeof existing.maxUses === "number" && existing.maxUses > 0) {
      mergedMaxUses = existing.maxUses;
    } else {
      return NextResponse.json(
        {
          error: "Maximum uses is required when unlimited uses is turned off.",
        },
        { status: 400 },
      );
    }
  } else if (body.maxUses !== undefined) {
    mergedMaxUses = Number(body.maxUses);
  }

  if (!hasPromoLimitingFactor(mergedMaxUses, computedExpiresAt)) {
    return NextResponse.json(
      {
        error:
          "Promo code must have at least one limit: max uses or expiry duration.",
      },
      { status: 400 },
    );
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json(
      { error: "No changes provided." },
      { status: 400 },
    );
  }

  const promoCode = await PromoCode.findByIdAndUpdate(
    id,
    { $set: update },
    {
      returnDocument: "after",
      runValidators: true,
      select:
        "code discountType discountValue maxUses usedCount expiresAt isActive createdAt",
    },
  ).lean();

  if (!promoCode) {
    return NextResponse.json(
      { error: "Promo code not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ data: promoCode });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json(
      { error: "Invalid promo code id." },
      { status: 400 },
    );
  }

  await connectDB();
  const promoCode = await PromoCode.findByIdAndUpdate(
    id,
    { $set: { isActive: false } },
    { returnDocument: "after", select: "_id" },
  ).lean();

  if (!promoCode) {
    return NextResponse.json(
      { error: "Promo code not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
