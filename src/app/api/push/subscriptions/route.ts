import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { connectDB } from "@/lib/db/mongoose";
import { PushSubscription } from "@/models/PushSubscription";
import { validateMutationRequest } from "@/lib/security/request";

interface SubscriptionPayload {
  endpoint?: unknown;
  expirationTime?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
}

function validateSubscription(value: SubscriptionPayload) {
  if (typeof value.endpoint !== "string" || value.endpoint.length > 2048)
    return false;
  try {
    if (new URL(value.endpoint).protocol !== "https:") return false;
  } catch {
    return false;
  }
  return (
    typeof value.keys?.p256dh === "string" &&
    typeof value.keys.auth === "string" &&
    value.keys.p256dh.length > 0 &&
    value.keys.auth.length > 0
  );
}

export async function GET() {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const count = await PushSubscription.countDocuments({
    userId: session.userId,
  });
  return NextResponse.json({ enabled: count > 0, devices: count });
}

export async function POST(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { subscription?: SubscriptionPayload };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const subscription = body.subscription;
  if (!subscription || !validateSubscription(subscription)) {
    return NextResponse.json(
      { error: "Invalid push subscription" },
      { status: 400 },
    );
  }

  await connectDB();
  await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    {
      $set: {
        userId: session.userId,
        endpoint: subscription.endpoint,
        expirationTime:
          typeof subscription.expirationTime === "number"
            ? subscription.expirationTime
            : null,
        keys: {
          p256dh: subscription.keys!.p256dh,
          auth: subscription.keys!.auth,
        },
        userAgent: req.headers.get("user-agent")?.slice(0, 500) ?? "",
      },
    },
    { upsert: true, new: true, runValidators: true },
  );
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const invalidRequest = validateMutationRequest(req);
  if (invalidRequest) return invalidRequest;
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { endpoint?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (typeof body.endpoint !== "string") {
    return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
  }

  await connectDB();
  await PushSubscription.deleteOne({
    userId: session.userId,
    endpoint: body.endpoint,
  });
  return NextResponse.json({ success: true });
}
