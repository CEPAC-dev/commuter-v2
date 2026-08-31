import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { getSession } from "@/lib/auth/session";
import { AdminSettings } from "@/models/AdminSettings";
import { DEFAULT_ADMIN_SETTINGS } from "@/lib/cancellationPolicy";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const settings = await AdminSettings.findOne().lean();
  if (!settings) {
    return NextResponse.json({ data: DEFAULT_ADMIN_SETTINGS });
  }

  return NextResponse.json({ data: settings });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      walletReserveAmount,
      defaultWithdrawalLimit,
      availabilityLockTime,
      cancellationTiers,
      passengerCancellationTiers,
    } = body;

    if (
      typeof walletReserveAmount !== "number" ||
      walletReserveAmount < 0 ||
      !Number.isFinite(walletReserveAmount)
    ) {
      return NextResponse.json(
        { error: "walletReserveAmount must be a non-negative number." },
        { status: 400 },
      );
    }

    if (
      defaultWithdrawalLimit !== undefined &&
      defaultWithdrawalLimit !== null &&
      (typeof defaultWithdrawalLimit !== "number" || defaultWithdrawalLimit <= 0 || !Number.isFinite(defaultWithdrawalLimit))
    ) {
      return NextResponse.json(
        { error: "defaultWithdrawalLimit must be a positive number or null." },
        { status: 400 },
      );
    }

    if (
      typeof availabilityLockTime !== "string" ||
      !/^\d{2}:\d{2}$/.test(availabilityLockTime)
    ) {
      return NextResponse.json(
        { error: "availabilityLockTime must be in HH:MM format (e.g. 17:00)." },
        { status: 400 },
      );
    }

    if (cancellationTiers && !Array.isArray(cancellationTiers)) {
      return NextResponse.json(
        { error: "cancellationTiers must be an array." },
        { status: 400 },
      );
    }

    if (passengerCancellationTiers && !Array.isArray(passengerCancellationTiers)) {
      return NextResponse.json(
        { error: "passengerCancellationTiers must be an array." },
        { status: 400 },
      );
    }

    await connectDB();

    const updated = await AdminSettings.findOneAndUpdate(
      {},
      {
        $set: {
          walletReserveAmount,
          defaultWithdrawalLimit: defaultWithdrawalLimit ?? null,
          availabilityLockTime,
          ...(cancellationTiers && { cancellationTiers }),
          ...(passengerCancellationTiers && { passengerCancellationTiers }),
        },
      },
      { upsert: true, new: true, runValidators: true },
    ).lean();

    return NextResponse.json({ ok: true, data: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update admin settings" },
      { status: 500 },
    );
  }
}
