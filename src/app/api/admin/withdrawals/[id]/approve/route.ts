import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { approveWithdrawalRequest } from "@/lib/wallet/wallet";

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

  try {
    const { request, wallet } = await approveWithdrawalRequest(id, session.userId);
    return NextResponse.json({
      ok: true,
      message: "Withdrawal request approved successfully.",
      status: request.status,
      balanceEgp: wallet.balanceEgp,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to approve withdrawal request." },
      { status: 400 },
    );
  }
}
