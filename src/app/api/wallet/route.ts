import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getOrCreateWallet } from "@/lib/wallet/wallet";
import { WalletTransaction } from "@/models/WalletTransaction";
import { reconcileDriverEarnings } from "@/lib/services/tripEarnings";
import { getAdminSettings } from "@/lib/cancellationPolicy";

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (session.role === "driver") {
    await reconcileDriverEarnings(session.userId);
  }

  const wallet = await getOrCreateWallet(session.userId);

  const txs = await WalletTransaction.find({ userId: session.userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  const transactions = (txs as Record<string, unknown>[]).map((t) => ({
    id: String(t._id),
    type: t.type as string,
    amountEgp: t.amountEgp as number,
    status: t.status as string,
    description: t.description as string,
    balanceAfterEgp: (t.balanceAfterEgp as number) ?? null,
    createdAt:
      t.createdAt instanceof Date
        ? t.createdAt.toISOString()
        : String(t.createdAt),
  }));

  const settings = await getAdminSettings();
  const reserveAmount =
    session.role === "driver"
      ? (wallet.reserveAmount ?? settings.walletReserveAmount ?? 200)
      : 0;
  const withdrawalLimit =
    session.role === "driver"
      ? (wallet.withdrawalLimit ?? settings.defaultWithdrawalLimit ?? null)
      : null;
  const pendingWithdrawalAmount =
    session.role === "driver"
      ? (wallet.pendingWithdrawalAmount ?? 0)
      : 0;

  const withdrawableEgp =
    session.role === "driver"
      ? Math.max(0, wallet.balanceEgp - reserveAmount - pendingWithdrawalAmount)
      : 0;

  return NextResponse.json({
    balanceEgp: wallet.balanceEgp,
    reservedBalanceEgp: wallet.reservedBalanceEgp ?? 0,
    reserveAmount,
    pendingWithdrawalAmount,
    withdrawalLimit,
    availableEgp: Math.max(
      0,
      (wallet.balanceEgp ?? 0) - (wallet.reservedBalanceEgp ?? 0),
    ),
    withdrawableEgp,
    status: wallet.status,
    role: session.role,
    transactions,
  });
}
