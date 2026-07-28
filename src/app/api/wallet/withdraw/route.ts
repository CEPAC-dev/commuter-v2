import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Driver } from "@/models/Driver";
import {
  MIN_WITHDRAWAL_EGP,
  MAX_WITHDRAWAL_EGP,
} from "@/lib/config/earnings";
import {
  initiateKashierPayout,
  maskDestination,
} from "@/lib/payments/kashierPayout";
import {
  getOrCreateWallet,
  reserveWithdrawal,
  completeWithdrawal,
  refundWithdrawal,
} from "@/lib/wallet/wallet";
import { WalletTransaction } from "@/models/WalletTransaction";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "driver") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let amount: number;
  try {
    ({ amount } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  amount = Math.round(Number(amount));
  if (
    !isFinite(amount) ||
    amount < MIN_WITHDRAWAL_EGP ||
    amount > MAX_WITHDRAWAL_EGP
  ) {
    return NextResponse.json(
      {
        error: `Withdrawal must be between ${MIN_WITHDRAWAL_EGP} and ${MAX_WITHDRAWAL_EGP} EGP.`,
      },
      { status: 400 },
    );
  }

  await connectDB();

  const driver = await Driver.findOne({ userId: session.userId }).lean<{
    payoutMethod?: "mobile_wallet" | "bank";
    payoutMobile?: string;
    payoutBankName?: string;
    payoutAccountNumber?: string;
    payoutAccountHolder?: string;
    verificationStatus: string;
  }>();

  if (!driver?.payoutMethod) {
    return NextResponse.json(
      { error: "Add a payout method before withdrawing." },
      { status: 400 },
    );
  }

  if (driver.verificationStatus !== "verified") {
    return NextResponse.json(
      { error: "Your driver profile must be verified to withdraw." },
      { status: 403 },
    );
  }

  if (driver.payoutMethod === "mobile_wallet") {
    const mobile = driver.payoutMobile?.replace(/\D/g, "") ?? "";
    if (!/^01\d{9}$/.test(mobile)) {
      return NextResponse.json(
        { error: "Invalid mobile wallet number. Use 01xxxxxxxxx." },
        { status: 400 },
      );
    }
  } else {
    if (
      !driver.payoutBankName?.trim() ||
      !driver.payoutAccountNumber?.trim() ||
      !driver.payoutAccountHolder?.trim()
    ) {
      return NextResponse.json(
        { error: "Complete your bank account details before withdrawing." },
        { status: 400 },
      );
    }
  }

  const wallet = await getOrCreateWallet(session.userId);
  if (wallet.balanceEgp < amount) {
    return NextResponse.json(
      { error: "Insufficient balance." },
      { status: 400 },
    );
  }

  const recipient =
    driver.payoutMethod === "mobile_wallet"
      ? {
          method: "mobile_wallet" as const,
          mobile: driver.payoutMobile,
        }
      : {
          method: "bank" as const,
          bankName: driver.payoutBankName,
          accountNumber: driver.payoutAccountNumber,
          accountHolder: driver.payoutAccountHolder,
        };

  const destination = maskDestination(recipient);

  const reserved = await reserveWithdrawal(session.userId, amount, {
    description: `Withdrawal to ${destination}`,
    payoutMethod: driver.payoutMethod,
    payoutDestination: destination,
  });

  if (!reserved) {
    return NextResponse.json(
      { error: "Insufficient balance." },
      { status: 400 },
    );
  }

  const payout = await initiateKashierPayout(
    reserved.transactionId,
    amount,
    recipient,
  );

  if (payout.status === "completed") {
    await completeWithdrawal(reserved.transactionId, payout.payoutId);
    await WalletTransaction.findByIdAndUpdate(reserved.transactionId, {
      kashierOrderId: reserved.transactionId,
      kashierPayoutId: payout.payoutId,
    });
    return NextResponse.json({
      status: "completed",
      balanceEgp: reserved.balanceAfterEgp,
      message: "Withdrawal sent successfully.",
    });
  }

  if (payout.status === "pending") {
    await WalletTransaction.findByIdAndUpdate(reserved.transactionId, {
      kashierOrderId: reserved.transactionId,
      kashierPayoutId: payout.payoutId,
    });
    return NextResponse.json({
      status: "pending",
      balanceEgp: reserved.balanceAfterEgp,
      message: "Withdrawal is being processed.",
    });
  }

  await refundWithdrawal(reserved.transactionId);
  return NextResponse.json(
    {
      error: payout.message ?? "Withdrawal failed. Funds returned to wallet.",
    },
    { status: 502 },
  );
}
