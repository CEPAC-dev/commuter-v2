import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { rejectWithdrawalRequest } from "@/lib/wallet/wallet";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing request ID" }, { status: 400 });
  }

  let reason: string | undefined;
  try {
    const body = await req.json();
    reason = body.reason;
  } catch {
    /* reason is optional */
  }

  try {
    const { request, wallet } = await rejectWithdrawalRequest(
      id,
      session.userId,
      reason,
    );
    return NextResponse.json({
      ok: true,
      message: "Withdrawal request rejected successfully.",
      status: request.status,
      pendingWithdrawalAmount: wallet.pendingWithdrawalAmount,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to reject withdrawal request." },
      { status: 400 },
    );
  }
}
