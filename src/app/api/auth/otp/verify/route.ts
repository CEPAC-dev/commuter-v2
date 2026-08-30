import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { getSession } from "@/lib/auth/session";
import { consumeSmsOtp } from "@/lib/auth/smsOtp";
import { User } from "@/models/User";
import { validateMutationRequest } from "@/lib/security/request";
import { enforceRateLimit } from "@/lib/security/rateLimit";

export async function POST(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;
  const limited = await enforceRateLimit(req, "sms-otp-verify", {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (limited) return limited;

  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { otp } = await req.json();
    await connectDB();
    const user = await User.findById(session.userId).select("phone role").lean();
    if (!user?.phone) return NextResponse.json({ error: "Phone number not found." }, { status: 400 });

    const verified = await consumeSmsOtp(
      {
        purpose: "phone_verification",
        userId: session.userId,
        phone: user.phone,
        role: user.role === "driver" ? "driver" : "passenger",
      },
      otp,
    );
    if (!verified) {
      return NextResponse.json({ error: "Invalid or expired verification code." }, { status: 400 });
    }

    await User.findByIdAndUpdate(session.userId, { phoneVerifiedAt: new Date() });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to verify this phone number." }, { status: 500 });
  }
}
