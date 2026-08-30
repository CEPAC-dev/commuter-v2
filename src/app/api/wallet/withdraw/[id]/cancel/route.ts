import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { cancelWithdrawalRequest } from "@/lib/wallet/wallet";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "driver") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing request ID" }, { status: 400 });
  }

  try {
    const { request, wallet } = await cancelWithdrawalRequest(id, session.userId);
    return NextResponse.json({
      ok: true,
      message: "Withdrawal request cancelled successfully.",
      status: request.status,
      pendingWithdrawalAmount: wallet.pendingWithdrawalAmount,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to cancel withdrawal request." },
      { status: 400 },
    );
  }
}
