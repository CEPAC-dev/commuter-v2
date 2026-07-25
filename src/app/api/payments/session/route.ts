import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { Request } from "@/models/Request";
import { Types } from "mongoose";

const KASHIER_URL =
  process.env.KASHIER_MODE === "live"
    ? "https://api.kashier.io/v3/payment/sessions"
    : "https://test-api.kashier.io/v3/payment/sessions";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let bookingId: string;
  try {
    ({ bookingId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!bookingId || !Types.ObjectId.isValid(bookingId))
    return NextResponse.json({ error: "Invalid bookingId" }, { status: 400 });

  await connectDB();

  const booking = await Request.findOne({
    _id: bookingId,
    userId: new Types.ObjectId(session.userId),
    paymentStatus: { $in: ["pending", "failed"] },
  });

  if (!booking)
    return NextResponse.json(
      { error: "Request not found or already paid." },
      { status: 404 },
    );

  let appUrl = process.env.APP_URL;
  if (!appUrl) {
    // Derive from incoming request when APP_URL is not set (safer for many deploys)
    const proto =
      req.headers.get("x-forwarded-proto") ||
      req.headers.get("x-forwarded-proto") ||
      "https";
    const host = req.headers.get("host") || "localhost:3000";
    appUrl = `${proto}://${host}`;
    console.warn("APP_URL env missing; derived from request as", appUrl);
  }
  const expireAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const body = {
    merchantOrderId: String(booking._id),
    merchantId: process.env.KASHIER_MERCHANT_ID!,
    amount: String(booking.amountEgp),
    currency: "EGP",
    // order: String(booking._id),
    // mode: process.env.KASHIER_MODE ?? "test",
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
    merchantRedirect: `${appUrl}/checkout/callback?bookingId=${bookingId}`,
    serverWebhook: `${appUrl}/api/payments/webhook`,
  };

  // Validate Kashier credentials early to avoid opaque upstream HTML errors
  if (!process.env.KASHIER_API_KEY || !process.env.KASHIER_SECRET_KEY || !process.env.KASHIER_MERCHANT_ID) {
    console.error('Kashier credentials missing: KASHIER_API_KEY/KASHIER_SECRET_KEY/KASHIER_MERCHANT_ID');
    return NextResponse.json(
      { error: 'Kashier credentials are not configured on the server.' },
      { status: 500 },
    );
  }

  // Helpful non-sensitive debug info
  console.error('Kashier request', { KASHIER_URL, merchantId: process.env.KASHIER_MERCHANT_ID });

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
    return NextResponse.json(
      { error: "Failed to reach payment gateway." },
      { status: 502 },
    );
  }

  // Read raw text and attempt safe JSON parse (some upstream errors return HTML)
  const kashierText = await kashierRes.text();
  let kashierData: any = null;
  try {
    kashierData = JSON.parse(kashierText);
  } catch (err) {
    console.error("Kashier non-JSON response", kashierRes.status, kashierText.substring(0, 200));
    return NextResponse.json(
      { error: "Payment gateway returned non-JSON response", status: kashierRes.status, details: kashierText },
      { status: 502 },
    );
  }

  if (!kashierRes.ok || !kashierData?.sessionUrl) {
    console.error("Kashier session error:", kashierRes.status, kashierData);
    return NextResponse.json(
      { error: "Payment gateway rejected the request.", details: kashierData },
      { status: 502 },
    );
  }

  await Request.findByIdAndUpdate(bookingId, {
    kashierSessionId: kashierData._id ?? "",
    kashierOrderId: String(booking._id),
  });

  return NextResponse.json({ sessionUrl: kashierData.sessionUrl });
}
