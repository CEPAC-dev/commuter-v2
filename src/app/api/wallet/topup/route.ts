import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { WalletTransaction } from "@/models/WalletTransaction";
import { Types } from "mongoose";
import { validateMutationRequest } from "@/lib/security/request";
import { validatePaymentAppUrl } from "@/lib/payments/sessionGuards";
import { verifyAndSettleTopup } from "@/lib/payments/kashier";

const KASHIER_URL =
  process.env.KASHIER_MODE === "live"
    ? "https://api.kashier.io/v3/payment/sessions"
    : "https://test-api.kashier.io/v3/payment/sessions";

const MIN_TOPUP = 10;
const MAX_TOPUP = 5000;

export async function POST(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;

  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let input:
    | { type: "resume"; topupId: string }
    | { type: "create"; amount: number };
  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const payload = body as Record<string, unknown>;
    if ("topupId" in payload) {
      if (
        typeof payload.topupId !== "string" ||
        !Types.ObjectId.isValid(payload.topupId)
      ) {
        return NextResponse.json(
          { error: "Invalid top-up request." },
          { status: 400 },
        );
      }
      input = { type: "resume", topupId: payload.topupId };
    } else {
      if (
        typeof payload.amount !== "number" ||
        !Number.isSafeInteger(payload.amount) ||
        payload.amount < MIN_TOPUP ||
        payload.amount > MAX_TOPUP
      ) {
        return NextResponse.json(
          {
            error: `Top-up must be between ${MIN_TOPUP} and ${MAX_TOPUP} EGP.`,
          },
          { status: 400 },
        );
      }
      input = { type: "create", amount: payload.amount };
    }
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const validation = validatePaymentAppUrl(process.env.APP_URL, {
    nodeEnv: process.env.NODE_ENV,
    appEnv: process.env.APP_ENV,
    kashierMode: process.env.KASHIER_MODE,
  });
  if (!validation.valid) {
    console.error("Invalid APP_URL for Kashier top-up", {
      host: validation.host,
    });
    return NextResponse.json(
      {
        errorCode: "INVALID_APP_URL",
        error: "APP_URL must be an absolute public URL for payment checkout.",
      },
      { status: 500 },
    );
  }
  const appUrl = validation.baseUrl;

  await connectDB();

  let topupId: string;
  let amount: number;
  if (input.type === "resume") {
    let tx = await WalletTransaction.findOne({
      _id: input.topupId,
      userId: session.userId,
      type: "topup",
    }).select("+kashierSessionUrl +kashierSessionExpiresAt");
    if (!tx) {
      return NextResponse.json({ error: "Top-up not found." }, { status: 404 });
    }
    if (tx.status === "completed") {
      return NextResponse.json({ status: "paid" });
    }
    if (tx.status !== "pending") {
      return NextResponse.json(
        { error: "This top-up is no longer pending." },
        { status: 409 },
      );
    }

    const verifiedStatus = await verifyAndSettleTopup(
      String(tx._id),
      session.userId,
    );
    if (verifiedStatus === "paid") {
      return NextResponse.json({ status: "paid" });
    }

    tx = await WalletTransaction.findOne({
      _id: input.topupId,
      userId: session.userId,
      type: "topup",
    }).select("+kashierSessionUrl +kashierSessionExpiresAt");
    if (!tx) {
      return NextResponse.json({ error: "Top-up not found." }, { status: 404 });
    }
    if (tx.status === "completed") {
      return NextResponse.json({ status: "paid" });
    }
    if (tx.status === "failed") {
      tx = await WalletTransaction.findOneAndUpdate(
        { _id: tx._id, userId: session.userId, type: "topup", status: "failed" },
        { $set: { status: "pending" } },
        { new: true },
      ).select("+kashierSessionUrl +kashierSessionExpiresAt");
    }
    if (!tx || tx.status !== "pending") {
      return NextResponse.json(
        { error: "This top-up can no longer be resumed." },
        { status: 409 },
      );
    }

    if (
      tx.kashierSessionUrl &&
      tx.kashierSessionExpiresAt &&
      tx.kashierSessionExpiresAt.getTime() > Date.now()
    ) {
      return NextResponse.json({ sessionUrl: tx.kashierSessionUrl });
    }
    topupId = String(tx._id);
    amount = tx.amountEgp;
  } else {
    amount = input.amount;
    // Create the pending ledger row first — its _id is the Kashier order id.
    const tx = await WalletTransaction.create({
      userId: new Types.ObjectId(session.userId),
      type: "topup",
      amountEgp: amount,
      status: "pending",
      description: `Wallet top-up of ${amount} EGP`,
    });
    topupId = String(tx._id);
  }

  const expireAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const body = {
    merchantOrderId: topupId,
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
    merchantRedirect: `${appUrl}/wallet?topupId=${topupId}`,
    serverWebhook: `${appUrl}/api/payments/webhook`,
  };

  // Validate Kashier credentials early to avoid opaque upstream HTML errors
  if (
    !process.env.KASHIER_API_KEY ||
    !process.env.KASHIER_SECRET_KEY ||
    !process.env.KASHIER_MERCHANT_ID
  ) {
    console.error(
      "Kashier credentials missing: KASHIER_API_KEY/KASHIER_SECRET_KEY/KASHIER_MERCHANT_ID",
    );
    if (input.type === "create") {
      await WalletTransaction.findByIdAndUpdate(topupId, { status: "failed" });
    }
    return NextResponse.json(
      { error: "Kashier credentials are not configured on the server." },
      { status: 500 },
    );
  }

  console.error("Kashier request (topup)", {
    KASHIER_URL,
    merchantId: process.env.KASHIER_MERCHANT_ID,
  });

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
    if (input.type === "create") {
      await WalletTransaction.findByIdAndUpdate(topupId, { status: "failed" });
    }
    return NextResponse.json(
      { error: "Failed to reach payment gateway." },
      { status: 502 },
    );
  }

  // Safe parse
  const kashierText = await kashierRes.text();
  let kashierData: Record<string, unknown> | null = null;
  try {
    kashierData = JSON.parse(kashierText) as Record<string, unknown>;
  } catch {
    console.error(
      "Kashier non-JSON response",
      kashierRes.status,
      kashierText.substring(0, 200),
    );
    if (input.type === "create") {
      await WalletTransaction.findByIdAndUpdate(topupId, { status: "failed" });
    }
    return NextResponse.json(
      {
        error: "Payment gateway returned non-JSON response",
        status: kashierRes.status,
        details: kashierText,
      },
      { status: 502 },
    );
  }

  if (
    !kashierRes.ok ||
    typeof kashierData?.sessionUrl !== "string" ||
    !kashierData.sessionUrl
  ) {
    console.error(
      "Kashier topup session error:",
      kashierRes.status,
      kashierData,
    );
    if (input.type === "create") {
      await WalletTransaction.findByIdAndUpdate(topupId, { status: "failed" });
    }
    return NextResponse.json(
      { error: "Payment gateway rejected the request.", details: kashierData },
      { status: 502 },
    );
  }

  await WalletTransaction.findByIdAndUpdate(topupId, {
    kashierSessionId: kashierData._id ?? "",
    kashierOrderId: topupId,
    kashierSessionUrl: kashierData.sessionUrl,
    kashierSessionExpiresAt: new Date(expireAt),
  });

  return NextResponse.json({ sessionUrl: kashierData.sessionUrl });
}
