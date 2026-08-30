import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { WithdrawalRequest } from "@/models/WithdrawalRequest";
import { Wallet } from "@/models/Wallet";
import { User } from "@/models/User";
import { getAdminSettings, computeWithdrawableBalance } from "@/lib/cancellationPolicy";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const statusFilter = searchParams.get("status"); // "pending", "approved", "rejected", "cancelled", or empty for all

  await connectDB();
  const settings = await getAdminSettings();

  const query: Record<string, unknown> = {};
  if (statusFilter && ["pending", "approved", "rejected", "cancelled"].includes(statusFilter)) {
    query.status = statusFilter;
  }

  const requests = await WithdrawalRequest.find(query)
    .sort({ createdAt: -1 })
    .lean();

  const driverIds = Array.from(new Set(requests.map((r) => String(r.driverId))));

  const [users, wallets] = await Promise.all([
    User.find({ _id: { $in: driverIds } }).select("name email phone").lean(),
    Wallet.find({ userId: { $in: driverIds } }).lean(),
  ]);

  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const walletMap = new Map(wallets.map((w) => [String(w.userId), w]));

  const data = requests.map((r: any) => {
    const driver = userMap.get(String(r.driverId));
    const wallet = walletMap.get(String(r.driverId));

    const balanceEgp = wallet?.balanceEgp ?? 0;
    const reserveAmount = wallet?.reserveAmount ?? settings.walletReserveAmount ?? 200;
    const pendingWithdrawalAmount = wallet?.pendingWithdrawalAmount ?? 0;
    const withdrawableEgp = computeWithdrawableBalance(
      balanceEgp,
      reserveAmount,
      pendingWithdrawalAmount,
    );

    return {
      id: String(r._id),
      driverId: String(r.driverId),
      driverName: driver?.name ?? "Unknown Driver",
      driverEmail: driver?.email ?? "",
      driverPhone: driver?.phone ?? "",
      amountEgp: r.amountEgp,
      status: r.status,
      payoutMethod: r.payoutMethod,
      payoutDestination: r.payoutDestination,
      rejectionReason: r.rejectionReason ?? null,
      requestedAt: r.requestedAt ? new Date(r.requestedAt).toISOString() : String(r.createdAt),
      resolvedAt: r.resolvedAt ? new Date(r.resolvedAt).toISOString() : null,
      wallet: {
        balanceEgp,
        reserveAmount,
        pendingWithdrawalAmount,
        withdrawableEgp,
        withdrawalLimit: wallet?.withdrawalLimit ?? settings.defaultWithdrawalLimit ?? null,
      },
    };
  });

  return NextResponse.json({ requests: data });
}
