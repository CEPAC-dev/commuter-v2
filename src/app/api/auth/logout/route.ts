import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";
import { validateMutationRequest } from "@/lib/security/request";

export async function POST(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req, { requireJson: false });
  if (invalidRequest) return invalidRequest;

  await destroySession();
  return NextResponse.json({ ok: true });
}
