import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Wallet } from "@/models/Wallet";
import { User } from "@/models/User";
import { Types } from "mongoose";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing driver user ID" }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { reserveAmount, withdrawalLimit } = body;

    const updates: Record<string, unknown> = {};

    if (reserveAmount !== undefined) {
      if (
        reserveAmount !== null &&
        (typeof reserveAmount !== "number" || reserveAmount < 0 || !Number.isFinite(reserveAmount))
      ) {
        return NextResponse.json(
          { error: "reserveAmount must be a non-negative number or null." },
          { status: 400 },
        );
      }
      updates.reserveAmount = reserveAmount;
    }

    if (withdrawalLimit !== undefined) {
      if (
        withdrawalLimit !== null &&
        (typeof withdrawalLimit !== "number" || withdrawalLimit <= 0 || !Number.isFinite(withdrawalLimit))
      ) {
        return NextResponse.json(
          { error: "withdrawalLimit must be a positive number or null." },
          { status: 400 },
        );
      }
      updates.withdrawalLimit = withdrawalLimit;
    }

    await connectDB();

    const user = await User.findById(id);
    if (!user || user.role !== "driver") {
      return NextResponse.json(
        { error: "Driver user not found." },
        { status: 404 },
      );
    }

    const wallet = await Wallet.findOneAndUpdate(
      { userId: new Types.ObjectId(id) },
      { $set: updates },
      { upsert: true, new: true },
    );

    return NextResponse.json({
      ok: true,
      data: {
        userId: String(wallet.userId),
        reserveAmount: wallet.reserveAmount ?? null,
        withdrawalLimit: wallet.withdrawalLimit ?? null,
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to update driver wallet settings." },
      { status: 500 },
    );
  }
}
