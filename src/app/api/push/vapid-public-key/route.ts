import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/notifications/webPush";

export async function GET() {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return NextResponse.json(
      { error: "Push notifications are not configured." },
      { status: 503 },
    );
  }
  return NextResponse.json({ publicKey });
}
