import { NextResponse } from "next/server";
import {
  advanceSupportStep,
  getInitialSupportStep,
  type SupportLocale,
} from "@/lib/support/decisionTree";

function parseLocale(value: string | null): SupportLocale {
  return value === "ar" ? "ar" : "en";
}

export async function GET(request: Request) {
  const locale = parseLocale(new URL(request.url).searchParams.get("locale"));
  return NextResponse.json(getInitialSupportStep(locale));
}

export async function POST(request: Request) {
  let body: { locale?: unknown; nodeId?: unknown; choiceId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (
    (body.locale !== "en" && body.locale !== "ar") ||
    typeof body.nodeId !== "string" ||
    body.nodeId.length > 80 ||
    typeof body.choiceId !== "string" ||
    body.choiceId.length > 80
  ) {
    return NextResponse.json({ error: "Invalid chatbot choice." }, { status: 400 });
  }

  const step = advanceSupportStep(body.locale, body.nodeId, body.choiceId);
  if (!step) {
    return NextResponse.json({ error: "That option is not available." }, { status: 400 });
  }

  return NextResponse.json(step);
}
