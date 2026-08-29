import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import {
  reconcilePendingTopups,
  reconcileStaleReservations,
} from "@/lib/payments/kashier";
import { validateMutationRequest } from "@/lib/security/request";
import { reconcileWalletFromLedger } from "@/lib/wallet/wallet";

export async function POST(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req, { requireJson: false });
  if (invalidRequest) return invalidRequest;

  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const credited = await reconcilePendingTopups(session.userId);
  const { released, settled } = await reconcileStaleReservations(
    session.userId,
  );
  const wallet = await reconcileWalletFromLedger(session.userId, true);
  return NextResponse.json({ credited, released, settled, wallet });
}
