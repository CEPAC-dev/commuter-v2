import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { WalletTransaction } from "@/models/WalletTransaction";
import { Types } from "mongoose";

const KASHIER_URL =
  process.env.KASHIER_MODE === "live"
    ? "https://api.kashier.io/v3/payment/sessions"
    : "https://test-api.kashier.io/v3/payment/sessions";

const MIN_TOPUP = 10;
const MAX_TOPUP = 5000;

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let amount: number;
  try {
    ({ amount } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  amount = Math.round(Number(amount));
  if (!isFinite(amount) || amount < MIN_TOPUP || amount > MAX_TOPUP) {
    return NextResponse.json(
      { error: `Top-up must be between ${MIN_TOPUP} and ${MAX_TOPUP} EGP.` },
      { status: 400 },
    );
  }

  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    return NextResponse.json(
      { error: "APP_URL is not configured on the server." },
      { status: 500 },
    );
  }

  await connectDB();

  // Create the pending ledger row first — its _id is the Kashier order id.
  const tx = await WalletTransaction.create({
    userId: new Types.ObjectId(session.userId),
    type: "topup",
    amountEgp: amount,
    status: "pending",
    description: `Wallet top-up of ${amount} EGP`,
  });

  const expireAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const body = {
    merchantOrderId: String(tx._id),
    merchantId: process.env.KASHIER_MERCHANT_ID!,
    amount: String(amount),
    currency: "EGP",
    paymentType: "credit",
    type: "one-time",
    maxFailureAttempts: 3,
    expireAt,
    display: "en",
    allowedMethods: "card,wallet",
    customer: {
      email: session.email,
      reference: String(session.userId),
    },
    merchantRedirect: `${appUrl}/wallet?topupId=${tx._id}`,
    serverWebhook: `${appUrl}/api/payments/webhook`,
  };

  let kashierRes: Response;
  try {
    kashierRes = await fetch(KASHIER_URL, {
      method: "POST",
      headers: {
        Authorization: process.env.KASHIER_SECRET_KEY!,
        "api-key": process.env.KASHIER_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("Kashier fetch error:", err);
    await WalletTransaction.findByIdAndUpdate(tx._id, { status: "failed" });
    return NextResponse.json(
      { error: "Failed to reach payment gateway." },
      { status: 502 },
    );
  }

  // Safe parse
  const kashierText = await kashierRes.text();
  let kashierData: any = null;
  try {
    kashierData = JSON.parse(kashierText);
  } catch (err) {
    console.error("Kashier non-JSON response", kashierRes.status, kashierText.substring(0, 200));
    await WalletTransaction.findByIdAndUpdate(tx._id, { status: "failed" });
    return NextResponse.json(
      { error: "Payment gateway returned non-JSON response", status: kashierRes.status, details: kashierText },
      { status: 502 },
    );
  }

  if (!kashierRes.ok || !kashierData?.sessionUrl) {
    console.error("Kashier topup session error:", kashierRes.status, kashierData);
    await WalletTransaction.findByIdAndUpdate(tx._id, { status: "failed" });
    return NextResponse.json(
      { error: "Payment gateway rejected the request.", details: kashierData },
      { status: 502 },
    );
  }

  await WalletTransaction.findByIdAndUpdate(tx._id, {
    kashierSessionId: kashierData._id ?? "",
    kashierOrderId: String(tx._id),
  });

  return NextResponse.json({ sessionUrl: kashierData.sessionUrl });
}
