import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { getOrCreateReferralSettings } from "@/lib/referral";
import { ReferralSettings } from "@/models/ReferralSettings";

function serializeSettings(settings: {
  discountPercentage: number;
  maxUsersPerCode: number;
  discountValidForTrips: number;
  isActive: boolean;
}) {
  return {
    discountPercentage: settings.discountPercentage,
    maxUsersPerCode: settings.maxUsersPerCode,
    discountValidForTrips: settings.discountValidForTrips,
    isActive: settings.isActive,
  };
}

export async function GET(req: NextRequest) {
  const auth = await adminAuth(req);
  if (!auth.authorized) return auth.response;

  const settings = await getOrCreateReferralSettings();
  return NextResponse.json({ data: serializeSettings(settings) });
}

export async function PUT(req: NextRequest) {
  const auth = await adminAuth(req);
  if (!auth.authorized) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const discountPercentage = Number(body.discountPercentage);
  const maxUsersPerCode = Number(body.maxUsersPerCode);
  const discountValidForTrips = Number(body.discountValidForTrips);
  const isActive = body.isActive;

  if (!Number.isFinite(discountPercentage) || discountPercentage < 0 || discountPercentage > 100) {
    return NextResponse.json(
      { error: "Discount percentage must be between 0 and 100." },
      { status: 400 },
    );
  }
  if (!Number.isInteger(maxUsersPerCode) || maxUsersPerCode < 1) {
    return NextResponse.json(
      { error: "Maximum users per code must be an integer of at least 1." },
      { status: 400 },
    );
  }
  if (!Number.isInteger(discountValidForTrips) || discountValidForTrips < 1) {
    return NextResponse.json(
      { error: "Discount-valid trips must be an integer of at least 1." },
      { status: 400 },
    );
  }
  if (typeof isActive !== "boolean") {
    return NextResponse.json({ error: "isActive must be a boolean." }, { status: 400 });
  }

  await getOrCreateReferralSettings();
  const settings = await ReferralSettings.findOneAndUpdate(
    { singletonKey: "global" },
    {
      $set: {
        discountPercentage,
        maxUsersPerCode,
        discountValidForTrips,
        isActive,
      },
    },
    { returnDocument: "after", runValidators: true },
  );

  return NextResponse.json({ data: serializeSettings(settings!) });
}