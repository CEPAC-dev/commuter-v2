import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/middleware/adminAuth";
import { getSmsMisrBalance } from "@/lib/smsmisr";

export async function GET() {
  const auth = await adminAuth();
  if (!auth.authorized) return auth.response;

  try {
    const balance = await getSmsMisrBalance();
    return NextResponse.json(
      { balance },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("SMS Misr balance failed", error);
    return NextResponse.json(
      { error: "SMS Misr balance is unavailable. Check the server configuration." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
