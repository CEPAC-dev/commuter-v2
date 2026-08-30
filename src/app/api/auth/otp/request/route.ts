import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { getSession } from "@/lib/auth/session";
import { normalizeEgyptPhone } from "@/lib/auth/validation";
import { createSmsOtp, deleteSmsOtp, type SmsOtpPurpose } from "@/lib/auth/smsOtp";
import { sendSmsMisrOtp } from "@/lib/smsmisr";
import { User } from "@/models/User";
import { validateMutationRequest } from "@/lib/security/request";
import { enforceRateLimit } from "@/lib/security/rateLimit";

const PURPOSES = new Set<SmsOtpPurpose>([
  "phone_verification",
  "password_change",
  "password_reset",
]);

export async function POST(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;
  const limited = await enforceRateLimit(req, "sms-otp-request", {
    limit: 3,
    windowMs: 15 * 60 * 1000,
  });
  if (limited) return limited;

  try {
    const { purpose, phone, role } = await req.json();
    if (!PURPOSES.has(purpose)) {
      return NextResponse.json({ error: "Invalid OTP purpose." }, { status: 400 });
    }

    await connectDB();
    let target: {
      purpose: SmsOtpPurpose;
      userId?: string;
      phone: string;
      role?: "passenger" | "driver";
    };

    if (purpose === "password_reset") {
      if (role !== "passenger" && role !== "driver") {
        return NextResponse.json({ error: "Invalid account role." }, { status: 400 });
      }
      const normalizedPhone = normalizeEgyptPhone(phone);
      if (!normalizedPhone) {
        return NextResponse.json({ error: "Enter a valid Egyptian mobile number." }, { status: 400 });
      }
      const user = await User.findOne({ phone: normalizedPhone, role }).select("_id").lean();
      if (!user) {
        return NextResponse.json({ error: "No account found with this phone number." }, { status: 404 });
      }
      target = { purpose, userId: String(user._id), phone: normalizedPhone, role };
    } else {
      const session = await getSession();
      if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const user = await User.findById(session.userId).select("phone role").lean();
      if (!user?.phone) {
        return NextResponse.json({ error: "Add a valid phone number to your profile first." }, { status: 400 });
      }
      target = {
        purpose,
        userId: session.userId,
        phone: user.phone,
        role: user.role === "driver" ? "driver" : "passenger",
      };
    }

    const otp = await createSmsOtp(target);
    try {
      await sendSmsMisrOtp({ phone: target.phone, otp });
    } catch (error) {
      await deleteSmsOtp(target);
      throw error;
    }

    return NextResponse.json({ ok: true, expiresInSeconds: 600 });
  } catch (error) {
    console.error("SMS OTP request failed", error);
    return NextResponse.json(
      { error: "We could not send a verification code. Please try again later." },
      { status: 503 },
    );
  }
}
