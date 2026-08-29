import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { generatePromoCode, normalizePromoCode } from "@/lib/promoCode";
import {
  computePromoExpiryFromDuration,
  hasPromoLimitingFactor,
} from "@/lib/promoCodeShared";
import { PromoCode } from "@/models/PromoCode";

export async function GET(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  await connectDB();

  const { searchParams } = new URL(req.url);
  const page = Number.parseInt(searchParams.get("page") ?? "1", 10);
  const limit = Number.parseInt(searchParams.get("limit") ?? "20", 10);
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const safeLimit =
    Number.isFinite(limit) && limit > 0 ? Math.min(limit, 100) : 20;
  const skip = (safePage - 1) * safeLimit;

  const [items, totalCount] = await Promise.all([
    PromoCode.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .select(
        "code discountType discountValue maxUses usedCount expiresAt isActive createdAt",
      )
      .lean(),
    PromoCode.countDocuments(),
  ]);

  return NextResponse.json({
    items,
    totalCount,
    page: safePage,
    limit: safeLimit,
  });
}

export async function POST(req: NextRequest) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  let body: {
    discountType?: string;
    discountValue?: number;
    maxUses?: number;
    customCode?: string;
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

  const discountType = body.discountType === "fixed" ? "fixed" : "percentage";
  const discountValue = Number(body.discountValue);
  const unlimitedUses = body.unlimitedUses === true;
  const maxUses = Number(body.maxUses);
  const expiryDays = Number(body.expiryDays ?? 0);
  const expiryHours = Number(body.expiryHours ?? 0);
  const expiryMinutes = Number(body.expiryMinutes ?? 0);
  const customCode =
    typeof body.customCode === "string" ? body.customCode.trim() : "";

  if (!Number.isFinite(discountValue)) {
    return NextResponse.json(
      { error: "Discount value is required." },
      { status: 400 },
    );
  }
  if (
    discountType === "percentage" &&
    (discountValue < 0 || discountValue > 100)
  ) {
    return NextResponse.json(
      { error: "Discount percentage must be between 0 and 100." },
      { status: 400 },
    );
  }
  if (discountType === "fixed" && discountValue <= 0) {
    return NextResponse.json(
      { error: "Fixed discount amount must be a positive number." },
      { status: 400 },
    );
  }
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

  if (!unlimitedUses && (!Number.isInteger(maxUses) || maxUses < 1)) {
    return NextResponse.json(
      { error: "Maximum uses must be an integer of at least 1." },
      { status: 400 },
    );
  }

  const expiresAt = computePromoExpiryFromDuration({
    days: expiryDays,
    hours: expiryHours,
    minutes: expiryMinutes,
  });
  const resolvedMaxUses = unlimitedUses ? null : maxUses;

  if (!hasPromoLimitingFactor(resolvedMaxUses, expiresAt)) {
    return NextResponse.json(
      {
        error:
          "Promo code must have at least one limit: max uses or expiry duration.",
      },
      { status: 400 },
    );
  }

  await connectDB();
  const code = customCode
    ? normalizePromoCode(customCode)
    : await generatePromoCode();

  try {
    const promoCode = await PromoCode.create({
      code,
      discountType,
      discountValue,
      maxUses: resolvedMaxUses,
      expiresAt,
      usedCount: 0,
      isActive: true,
      createdBy: new Types.ObjectId(auth.userId),
    });
    return NextResponse.json(
      {
        data: {
          id: String(promoCode._id),
          code: promoCode.code,
          discountType: promoCode.discountType,
          discountValue: promoCode.discountValue,
          maxUses: promoCode.maxUses,
          usedCount: promoCode.usedCount,
          expiresAt: promoCode.expiresAt,
          isActive: promoCode.isActive,
          createdAt: promoCode.createdAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      return NextResponse.json(
        { error: "Promo code already exists." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Failed to create promo code." },
      { status: 500 },
    );
  }
}
