import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { Types } from "mongoose";
import { SmsOtp } from "@/models/SmsOtp";

export type SmsOtpPurpose =
  | "phone_verification"
  | "password_change"
  | "password_reset";

type OtpTarget = {
  purpose: SmsOtpPurpose;
  userId?: string;
  phone: string;
  role?: "passenger" | "driver";
};

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function otpSecret() {
  const secret = process.env.OTP_SECRET || process.env.JWT_SECRET;
  if (!secret) throw new Error("OTP_SECRET or JWT_SECRET is not set");
  return secret;
}

function hashOtp(code: string) {
  return createHmac("sha256", otpSecret()).update(code).digest("hex");
}

function targetFilter(target: OtpTarget) {
  return {
    purpose: target.purpose,
    phone: target.phone,
    ...(target.userId ? { userId: new Types.ObjectId(target.userId) } : {}),
    ...(target.role ? { role: target.role } : {}),
  };
}

export async function createSmsOtp(target: OtpTarget) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const filter = targetFilter(target);
  await SmsOtp.findOneAndUpdate(
    filter,
    {
      $set: {
        ...filter,
        codeHash: hashOtp(code),
        attempts: 0,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    },
    { upsert: true, setDefaultsOnInsert: true },
  );
  return code;
}

export async function deleteSmsOtp(target: OtpTarget) {
  await SmsOtp.deleteMany(targetFilter(target));
}

export async function consumeSmsOtp(target: OtpTarget, code: unknown) {
  if (typeof code !== "string" || !/^\d{6}$/.test(code)) return false;

  const record = await SmsOtp.findOne({
    ...targetFilter(target),
    expiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .select("+codeHash attempts expiresAt");
  if (!record) return false;
  if (record.attempts >= MAX_ATTEMPTS) {
    await record.deleteOne();
    return false;
  }

  const expected = Buffer.from(record.codeHash, "hex");
  const actual = Buffer.from(hashOtp(code), "hex");
  const matches =
    expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!matches) {
    await SmsOtp.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
    return false;
  }

  const consumed = await SmsOtp.deleteOne({
    _id: record._id,
    codeHash: record.codeHash,
    expiresAt: { $gt: new Date() },
  });
  return consumed.deletedCount === 1;
}
