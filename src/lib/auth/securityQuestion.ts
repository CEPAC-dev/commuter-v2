import "server-only";
import bcrypt from "bcryptjs";
import { AdminSettings } from "@/models/AdminSettings";
import { connectDB } from "@/lib/db/mongoose";
import {
  DEFAULT_VERIFICATION_METHOD,
  isVerificationMethod,
  type VerificationMethod,
} from "@/lib/config/verification";

// Read the currently configured verification method from the singleton
// AdminSettings document. Falls back to DEFAULT_VERIFICATION_METHOD when
// settings do not exist or are misconfigured.
export async function getActiveVerificationMethod(): Promise<VerificationMethod> {
  await connectDB();
  const settings = await AdminSettings.findOne()
    .select("verificationMethod")
    .lean<{ verificationMethod?: string }>();
  const v = settings?.verificationMethod;
  return isVerificationMethod(v) ? v : DEFAULT_VERIFICATION_METHOD;
}

// Normalize free-form answers before hashing / comparing so trivial casing
// and whitespace differences do not lock the user out.
function normalizeAnswer(raw: string) {
  return raw.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

export function isPlausibleSecurityAnswer(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  const n = normalizeAnswer(raw);
  return n.length >= 2 && n.length <= 120;
}

export async function hashSecurityAnswer(answer: string) {
  return bcrypt.hash(normalizeAnswer(answer), 12);
}

export async function verifySecurityAnswer(answer: string, hash: string) {
  if (!hash) return false;
  return bcrypt.compare(normalizeAnswer(answer), hash);
}
