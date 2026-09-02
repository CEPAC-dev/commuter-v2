import { NextResponse } from "next/server";
import { getActiveVerificationMethod } from "@/lib/auth/securityQuestion";
import { SECURITY_QUESTIONS } from "@/lib/config/verification";

export async function GET() {
  try {
    const method = await getActiveVerificationMethod();
    return NextResponse.json({
      method,
      questions: method === "security_question" ? SECURITY_QUESTIONS : [],
    });
  } catch {
    return NextResponse.json({ method: "sms_otp", questions: [] });
  }
}
