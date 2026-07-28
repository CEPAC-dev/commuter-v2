import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getOrCreateWallet } from "@/lib/wallet/wallet";
import { WalletTransaction } from "@/models/WalletTransaction";
import { reconcileDriverEarnings } from "@/lib/services/tripEarnings";

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

  return NextResponse.json({
    balanceEgp: wallet.balanceEgp,
    status: wallet.status,
    role: session.role,
    transactions,
  });
}
