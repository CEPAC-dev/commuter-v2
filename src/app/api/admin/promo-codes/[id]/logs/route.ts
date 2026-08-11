import { NextRequest, NextResponse } from "next/server";
import { Types } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { PromoCodeUsage } from "@/models/PromoCodeUsage";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await adminAuth(req);
  if (!auth.authorized) return auth.response;

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid promo code id." }, { status: 400 });
  }

  await connectDB();

  const [items, totalCount] = await Promise.all([
    PromoCodeUsage.find({ promoCode: id })
      .sort({ createdAt: -1 })
      .populate({ path: "user", select: "name phone" })
      .populate({ path: "trip", select: "tripNumber date pickup dropoff" })
      .lean(),
    PromoCodeUsage.countDocuments({ promoCode: id }),
  ]);

  return NextResponse.json({
    totalCount,
    items,
  });
}
