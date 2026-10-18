import { NextRequest, NextResponse } from "next/server";
import mongoose, { Types } from "mongoose";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { connectDB } from "@/lib/db/mongoose";
import { Log } from "@/models/Log";
import { User } from "@/models/User";
import { Wallet } from "@/models/Wallet";
import { WalletTransaction } from "@/models/WalletTransaction";
import {
  buildAdminWalletAdjustmentUpdate,
  computeWalletAdjustment,
  isAdminWalletAdjustmentAuthorized,
  type WalletAdjustmentType,
} from "@/lib/walletPenalty";

function isAdjustmentType(value: unknown): value is WalletAdjustmentType {
  return value === "waive_debt" || value === "refund_penalty";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ driverId: string }> },
) {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;
  if (!isAdminWalletAdjustmentAuthorized("admin")) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { driverId } = await params;
  if (!Types.ObjectId.isValid(driverId)) {
    return NextResponse.json({ error: "Invalid driver ID." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid adjustment body." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const type = input.type;
  const amountEgp = input.amountEgp;
  const note = typeof input.note === "string" ? input.note.trim() : "";
  if (!isAdjustmentType(type)) {
    return NextResponse.json({ error: "Invalid adjustment type." }, { status: 400 });
  }
  if (
    typeof amountEgp !== "number" ||
    !Number.isFinite(amountEgp) ||
    amountEgp <= 0 ||
    Math.abs(amountEgp * 100 - Math.round(amountEgp * 100)) > 1e-7
  ) {
    return NextResponse.json(
      { error: "amountEgp must be a positive amount with at most two decimals." },
      { status: 400 },
    );
  }
  if (!note || note.length > 500) {
    return NextResponse.json(
      { error: "A note of 1 to 500 characters is required." },
      { status: 400 },
    );
  }

  await connectDB();
  const driverObjectId = new Types.ObjectId(driverId);
  const driver = await User.findOne({ _id: driverObjectId, role: "driver" })
    .select("_id")
    .lean();
  if (!driver) {
    return NextResponse.json({ error: "Driver not found." }, { status: 404 });
  }

  const dbSession = await mongoose.startSession();
  let result:
    | {
        balanceEgp: number;
        owedEgp: number;
        appliedAmountEgp: number;
        debtReductionEgp: number;
        balanceCreditEgp: number;
      }
    | undefined;
  try {
    await dbSession.withTransaction(async () => {
      const walletBefore = await Wallet.findOne({
        userId: driverObjectId,
      }).session(dbSession);
      const adjustment = computeWalletAdjustment({
        type,
        balanceEgp: walletBefore?.balanceEgp ?? 0,
        owedEgp: walletBefore?.owedEgp ?? 0,
        amountEgp,
      });
      const filter: Record<string, unknown> = { userId: driverObjectId };
      if (walletBefore) {
        filter.balanceEgp =
          walletBefore.balanceEgp == null
            ? { $in: [0, null] }
            : walletBefore.balanceEgp;
        filter.owedEgp =
          walletBefore.owedEgp == null
            ? { $in: [0, null] }
            : walletBefore.owedEgp;
      }
      const appliedAt = new Date();
      const wallet = await Wallet.findOneAndUpdate(
        filter,
        buildAdminWalletAdjustmentUpdate(
          driverObjectId,
          adjustment,
          appliedAt,
        ),
        {
          returnDocument: "after",
          upsert: !walletBefore,
          session: dbSession,
        },
      );
      if (!wallet) throw new Error("Wallet adjustment failed.");

      if (adjustment.balanceCreditEgp > 0) {
        await WalletTransaction.create(
          [
            {
              userId: driverObjectId,
              type: "refund",
              amountEgp: adjustment.balanceCreditEgp,
              status: "completed",
              description: "Admin refunded a driver cancellation penalty.",
              balanceAfterEgp: adjustment.newBalanceEgp,
            },
          ],
          { session: dbSession },
        );
      }

      await Log.create(
        [
          {
            userId: auth.userId,
            driverId: driverObjectId,
            status: "completed",
            action: "admin_wallet_adjusted",
            description: note,
            actorType: "admin",
            actorId: new Types.ObjectId(auth.userId),
            actionTimestamp: appliedAt,
            metadata: {
              type,
              requestedAmountEgp: amountEgp,
              appliedAmountEgp: adjustment.appliedAmountEgp,
              debtReductionEgp: adjustment.debtReductionEgp,
              balanceCreditEgp: adjustment.balanceCreditEgp,
            },
          },
        ],
        { session: dbSession },
      );

      result = {
        balanceEgp: wallet.balanceEgp,
        owedEgp: wallet.owedEgp ?? 0,
        appliedAmountEgp: adjustment.appliedAmountEgp,
        debtReductionEgp: adjustment.debtReductionEgp,
        balanceCreditEgp: adjustment.balanceCreditEgp,
      };
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Wallet adjustment failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await dbSession.endSession();
  }

  if (!result) {
    return NextResponse.json(
      { error: "Wallet adjustment did not complete." },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, data: result });
}
