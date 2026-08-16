import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { getOrCreateReferralSettings } from "@/lib/referral";
import { ReferralSettings } from "@/models/ReferralSettings";

function serializeSettings(settings: {
  referrerBonusAmount: number;
  refereeBonusAmount: number;
  maxUsersPerCode: number;
  isActive: boolean;
}) {
  return {
    referrerBonusAmount: settings.referrerBonusAmount,
    refereeBonusAmount: settings.refereeBonusAmount,
    maxUsersPerCode: settings.maxUsersPerCode,
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

  const referrerBonusAmount = Number(body.referrerBonusAmount);
  const refereeBonusAmount = Number(body.refereeBonusAmount);
  const maxUsersPerCode = Number(body.maxUsersPerCode);
  const isActive = body.isActive;

  if (!Number.isFinite(referrerBonusAmount) || referrerBonusAmount < 0) {
    return NextResponse.json(
      { error: "Referrer bonus must be a non-negative amount." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(refereeBonusAmount) || refereeBonusAmount < 0) {
    return NextResponse.json(
      { error: "New user bonus must be a non-negative amount." },
      { status: 400 },
    );
  }
  if (!Number.isInteger(maxUsersPerCode) || maxUsersPerCode < 1) {
    return NextResponse.json(
      { error: "Maximum users per code must be an integer of at least 1." },
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
        referrerBonusAmount,
        refereeBonusAmount,
        maxUsersPerCode,
        isActive,
      },
    },
    { returnDocument: "after", runValidators: true },
  );

  return NextResponse.json({ data: serializeSettings(settings!) });
}