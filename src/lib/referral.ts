import "server-only";
import { randomBytes } from "crypto";
import mongoose, { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { ReferralSettings } from "@/models/ReferralSettings";
import { ReferralUsage } from "@/models/ReferralUsage";
import { Trip } from "@/models/Trip";
import { User } from "@/models/User";
import { Wallet } from "@/models/Wallet";
import { WalletTransaction } from "@/models/WalletTransaction";

const REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_CODE_ATTEMPTS = 10;

export interface ReferralResult {
  success: boolean;
  message: string;
}

export async function getOrCreateReferralSettings() {
  await connectDB();
  return ReferralSettings.findOneAndUpdate(
    { singletonKey: "global" },
    { $setOnInsert: { singletonKey: "global" } },
    { upsert: true, returnDocument: "after", runValidators: true },
  );
}

export async function generateReferralCode(): Promise<string> {
  await connectDB();

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const bytes = randomBytes(6);
    const suffix = Array.from(bytes, (byte) => REFERRAL_ALPHABET[byte % REFERRAL_ALPHABET.length]).join("");
    const referralCode = `REF-${suffix}`;
    const exists = await User.exists({ referralCode });
    if (!exists) return referralCode;
  }

  throw new Error("Unable to generate a unique referral code");
}

export async function applyReferralOnSignup(
  referralCode: string,
  newUserId: string | Types.ObjectId,
): Promise<ReferralResult> {
  await connectDB();

  if (!Types.ObjectId.isValid(newUserId)) {
    return { success: false, message: "Invalid new user." };
  }

  const settings = await ReferralSettings.findOne({ singletonKey: "global" }).lean();
  if (!settings || !settings.isActive) {
    return { success: false, message: "Referrals are not currently active." };
  }

  const normalizedCode = referralCode.trim().toUpperCase();
  const referrer = await User.findOne({ referralCode: normalizedCode }).select("_id").lean();
  if (!referrer) {
    return { success: false, message: "Referral code is invalid." };
  }

  const referredUserId = new Types.ObjectId(String(newUserId));
  if (String(referrer._id) === String(referredUserId)) {
    return { success: false, message: "You cannot use your own referral code." };
  }

  const referredUser = await User.findById(referredUserId).select("referredBy").lean();
  if (!referredUser || referredUser.referredBy) {
    return { success: false, message: "This account cannot use a referral code." };
  }

  const usageCount = await ReferralUsage.countDocuments({ referrer: referrer._id });
  if (usageCount >= settings.maxUsersPerCode) {
    return { success: false, message: "This referral code has reached its usage limit." };
  }

  let usageId: Types.ObjectId | null = null;
  try {
    const usage = await ReferralUsage.create({
      referrer: referrer._id,
      referredUser: referredUserId,
      referrerBonusAmount: settings.referrerBonusAmount,
      refereeBonusAmount: settings.refereeBonusAmount,
      status: "pending",
      creditedAt: null,
      firstTripId: null,
    });
    usageId = usage._id;

    const updated = await User.updateOne(
      { _id: referredUserId, referredBy: null },
      { $set: { referredBy: referrer._id } },
    );
    if (updated.modifiedCount !== 1) {
      await ReferralUsage.deleteOne({ _id: usage._id });
      return { success: false, message: "This account cannot use a referral code." };
    }
  } catch (error) {
    if (usageId) await ReferralUsage.deleteOne({ _id: usageId });
    if ((error as { code?: number }).code === 11000) {
      return { success: false, message: "This account already used a referral code." };
    }
    throw error;
  }

  return { success: true, message: "Referral applied successfully." };
}

export async function creditReferralBonusIfEligible(
  referredUserId: string,
  tripId: string,
): Promise<boolean> {
  if (!Types.ObjectId.isValid(referredUserId) || !Types.ObjectId.isValid(tripId)) {
    return false;
  }

  await connectDB();
  const session = await mongoose.startSession();
  try {
    let credited = false;
    await session.withTransaction(async () => {
      const currentTrip = await Trip.findOne({
        _id: tripId,
        userId: referredUserId,
        status: "completed",
        paymentStatus: "paid",
      })
        .select("_id")
        .session(session)
        .lean();
      if (!currentTrip) return;

      const priorCompletedTrip = await Trip.findOne({
        userId: referredUserId,
        status: "completed",
        paymentStatus: "paid",
        _id: { $ne: new Types.ObjectId(tripId) },
      })
        .select("_id")
        .session(session)
        .lean();
      if (priorCompletedTrip) return;

      const usage = await ReferralUsage.findOneAndUpdate(
        { referredUser: referredUserId, status: "pending" },
        {
          $set: {
            status: "credited",
            creditedAt: new Date(),
            firstTripId: new Types.ObjectId(tripId),
          },
        },
        { new: true, session },
      )
        .select("referrer referrerBonusAmount refereeBonusAmount")
        .lean();
      if (!usage) return;

      const referrerWallet = await Wallet.findOneAndUpdate(
        { userId: usage.referrer },
        {
          $inc: {
            balanceEgp: usage.referrerBonusAmount,
            totalCreditedEgp: usage.referrerBonusAmount,
          },
          $set: { lastTransactionAt: new Date() },
        },
        { new: true, upsert: true, session },
      ).lean();
      const refereeWallet = await Wallet.findOneAndUpdate(
        { userId: new Types.ObjectId(referredUserId) },
        {
          $inc: {
            balanceEgp: usage.refereeBonusAmount,
            totalCreditedEgp: usage.refereeBonusAmount,
          },
          $set: { lastTransactionAt: new Date() },
        },
        { new: true, upsert: true, session },
      ).lean();

      await WalletTransaction.create(
        [
          {
            userId: usage.referrer,
            type: "referral_bonus",
            amountEgp: usage.referrerBonusAmount,
            status: "completed",
            description: "Referral bonus",
            balanceAfterEgp: referrerWallet?.balanceEgp ?? 0,
            tripId: new Types.ObjectId(tripId),
            referralUsageId: usage._id,
          },
          {
            userId: new Types.ObjectId(referredUserId),
            type: "referral_bonus",
            amountEgp: usage.refereeBonusAmount,
            status: "completed",
            description: "Welcome referral bonus",
            balanceAfterEgp: refereeWallet?.balanceEgp ?? 0,
            tripId: new Types.ObjectId(tripId),
            referralUsageId: usage._id,
          },
        ],
        { session },
      );
      credited = true;
    });
    return credited;
  } finally {
    await session.endSession();
  }
}