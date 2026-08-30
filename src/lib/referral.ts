import "server-only";
import { randomBytes } from "crypto";
import mongoose, { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import {
  type ReferralSettingsRole,
  ReferralSettings,
} from "@/models/ReferralSettings";
import { ReferralUsage } from "@/models/ReferralUsage";
import { Notification } from "@/models/Notification";
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

export async function getOrCreateReferralSettings(
  role: ReferralSettingsRole = "passenger",
) {
  await connectDB();

  const existing = await ReferralSettings.findOne({ singletonKey: role });
  if (existing) return existing;

  // Preserve the original global configuration as the passenger baseline.
  const legacySettings = await ReferralSettings.findOne({ singletonKey: "global" })
    .select("referrerBonusAmount refereeBonusAmount maxUsersPerCode isActive")
    .lean();

  return ReferralSettings.findOneAndUpdate(
    { singletonKey: role },
    {
      $setOnInsert: {
        singletonKey: role,
        ...(role === "passenger" && legacySettings
          ? {
              referrerBonusAmount: legacySettings.referrerBonusAmount,
              refereeBonusAmount: legacySettings.refereeBonusAmount,
              maxUsersPerCode: legacySettings.maxUsersPerCode,
              isActive: legacySettings.isActive,
            }
          : {}),
      },
    },
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

  const normalizedCode = referralCode.trim().toUpperCase();
  const referrer = await User.findOne({ referralCode: normalizedCode })
    .select("_id role referralUnlimited")
    .lean();
  if (!referrer) {
    return { success: false, message: "Referral code is invalid." };
  }

  if (referrer.role !== "passenger" && referrer.role !== "driver") {
    return { success: false, message: "Referral code is invalid." };
  }

  const settings = await getOrCreateReferralSettings(referrer.role);
  if (!settings.isActive) {
    return { success: false, message: "Referrals are not currently active." };
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
  if (!referrer.referralUnlimited && usageCount >= settings.maxUsersPerCode) {
    return { success: false, message: "This referral code has reached its usage limit." };
  }

  const session = await mongoose.startSession();
  try {
    let result: ReferralResult = { success: false, message: "Referral failed." };
    await session.withTransaction(async () => {
      // 1. Create ReferralUsage directly with status "credited"
      const usageArr = await ReferralUsage.create(
        [
          {
            referrer: referrer._id,
            referredUser: referredUserId,
            referrerBonusAmount: settings.referrerBonusAmount,
            refereeBonusAmount: settings.refereeBonusAmount,
            status: "credited",
            creditedAt: new Date(),
            firstTripId: null,
          },
        ],
        { session },
      );
      const usage = usageArr[0];

      // 2. Link referredBy on the referred user
      const updated = await User.updateOne(
        { _id: referredUserId, referredBy: null },
        { $set: { referredBy: referrer._id } },
        { session },
      );
      if (updated.modifiedCount !== 1) {
        throw new Error("ALREADY_REFERRED");
      }

      // 3. Atomically increment Wallets
      const referrerWallet = await Wallet.findOneAndUpdate(
        { userId: referrer._id },
        {
          $inc: {
            balanceEgp: settings.referrerBonusAmount,
            totalCreditedEgp: settings.referrerBonusAmount,
          },
          $set: { lastTransactionAt: new Date() },
        },
        { returnDocument: "after", upsert: true, session },
      ).lean();

      const refereeWallet = await Wallet.findOneAndUpdate(
        { userId: referredUserId },
        {
          $inc: {
            balanceEgp: settings.refereeBonusAmount,
            totalCreditedEgp: settings.refereeBonusAmount,
          },
          $set: { lastTransactionAt: new Date() },
        },
        { returnDocument: "after", upsert: true, session },
      ).lean();

      const referrerNewBalance = referrerWallet?.balanceEgp ?? settings.referrerBonusAmount;
      const refereeNewBalance = refereeWallet?.balanceEgp ?? settings.refereeBonusAmount;

      // 4. Create WalletTransactions
      await WalletTransaction.create(
        [
          {
            userId: referrer._id,
            type: "referral_bonus",
            amountEgp: settings.referrerBonusAmount,
            status: "completed",
            description: "Referral bonus",
            balanceAfterEgp: referrerNewBalance,
            referralUsageId: usage._id,
          },
          {
            userId: referredUserId,
            type: "referral_bonus",
            amountEgp: settings.refereeBonusAmount,
            status: "completed",
            description: "Welcome referral bonus",
            balanceAfterEgp: refereeNewBalance,
            referralUsageId: usage._id,
          },
        ],
        { session },
      );

      // 5. Create Notifications for both users
      await Notification.create(
        [
          {
            userId: referrer._id,
            type: "referral_bonus",
            title: "Referral bonus received",
            body: `Someone signed up with your referral code — your wallet is now ${referrerNewBalance} EGP (+${settings.referrerBonusAmount}).`,
            data: {
              amount: settings.referrerBonusAmount,
              newBalanceEgp: referrerNewBalance,
              referralUsageId: usage._id,
            },
          },
          {
            userId: referredUserId,
            type: "referral_bonus",
            title: "Welcome bonus credited",
            body: `Your referral bonus has been credited — your wallet is now ${refereeNewBalance} EGP (+${settings.refereeBonusAmount}).`,
            data: {
              amount: settings.refereeBonusAmount,
              newBalanceEgp: refereeNewBalance,
              referralUsageId: usage._id,
            },
          },
        ],
        { session },
      );

      result = { success: true, message: "Referral applied successfully." };
    });
    return result;
  } catch (error) {
    if (
      (error as { code?: number }).code === 11000 ||
      (error as { message?: string }).message === "ALREADY_REFERRED"
    ) {
      return { success: false, message: "This account already used a referral code." };
    }
    console.error("Referral instant crediting failed:", error);
    return { success: false, message: "Failed to apply referral code." };
  } finally {
    await session.endSession();
  }
}

/**
 * Legacy crediting on trip completion — neutralized because crediting now occurs instantly on signup.
 */
export async function creditReferralBonusIfEligible(
  _referredUserId: string,
  _tripId: string,
): Promise<boolean> {
  // Neutralized: Referral bonuses are now credited instantly on signup in applyReferralOnSignup.
  return false;
}
