import { NextRequest, NextResponse } from "next/server";
import { validateMutationRequest } from "@/lib/security/request";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Driver } from "@/models/Driver";
import { WithdrawalRequest } from "@/models/WithdrawalRequest";
import { MIN_WITHDRAWAL_EGP, MAX_WITHDRAWAL_EGP } from "@/lib/config/earnings";
import { maskDestination } from "@/lib/payments/kashierPayout";
import { createWithdrawalRequest } from "@/lib/wallet/wallet";

export async function GET() {
  const session = await getSession();
  if (!session || session.role !== "driver") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const requests = await WithdrawalRequest.find({ driverId: session.userId })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean();

  return NextResponse.json({
    requests: requests.map((r: any) => ({
      id: String(r._id),
      amountEgp: r.amountEgp,
      status: r.status,
      payoutMethod: r.payoutMethod,
      payoutDestination: r.payoutDestination,
      rejectionReason: r.rejectionReason ?? null,
      requestedAt: r.requestedAt ? new Date(r.requestedAt).toISOString() : String(r.createdAt),
      resolvedAt: r.resolvedAt ? new Date(r.resolvedAt).toISOString() : null,
    })),
  });
}

export async function POST(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;

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

  if (!Number.isSafeInteger(amount)) {
    return NextResponse.json(
      { error: "Withdrawal amount must be a whole number." },
      { status: 400 },
    );
  }
  if (amount < MIN_WITHDRAWAL_EGP || amount > MAX_WITHDRAWAL_EGP) {
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

  try {
    const { request, wallet } = await createWithdrawalRequest(
      session.userId,
      amount,
      driver.payoutMethod,
      destination,
    );

    return NextResponse.json({
      status: "pending",
      requestId: String(request._id),
      pendingWithdrawalAmount: wallet.pendingWithdrawalAmount,
      balanceEgp: wallet.balanceEgp,
      message: "Withdrawal request submitted successfully and is awaiting admin approval.",
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to submit withdrawal request." },
      { status: 400 },
    );
  }
}
