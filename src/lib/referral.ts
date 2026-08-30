import "server-only";
import { randomBytes } from "crypto";
import mongoose, { Types, type ClientSession } from "mongoose";
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
  session?: ClientSession,
) {
  await connectDB();

  const existing = await ReferralSettings.findOne({ singletonKey: role }).session(
    session ?? null,
  );
  if (existing) return existing;

  // Preserve the original global configuration as the passenger baseline.
  const legacySettings = await ReferralSettings.findOne({ singletonKey: "global" })
    .select("referrerBonusAmount refereeBonusAmount maxUsersPerCode isActive")
    .session(session ?? null)
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
    {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
      ...(session ? { session } : {}),
    },
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
    .select("_id")
    .lean();
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

  const session = await mongoose.startSession();
  try {
    let result: ReferralResult = { success: false, message: "Referral failed." };
    await session.withTransaction(async () => {
      // Serialize referrals for this code so concurrent transactions cannot share a stale count.
      const lockedReferrer = await User.findOneAndUpdate(
        { _id: referrer._id },
        { $inc: { referralLockVersion: 1 } },
        { returnDocument: "after", session },
      )
        .select("_id role referralUnlimited")
        .lean();

      if (
        !lockedReferrer ||
        (lockedReferrer.role !== "passenger" && lockedReferrer.role !== "driver")
      ) {
        throw new Error("INVALID_REFERRER");
      }

      const settings = await getOrCreateReferralSettings(
        lockedReferrer.role,
        session,
      );
      if (!settings.isActive) {
        throw new Error("REFERRALS_INACTIVE");
      }

      const usageCount = await ReferralUsage.countDocuments({
        referrer: lockedReferrer._id,
      }).session(session);
      if (
        !lockedReferrer.referralUnlimited &&
        usageCount >= settings.maxUsersPerCode
      ) {
        throw new Error("REFERRAL_LIMIT_REACHED");
      }

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
        { session, ordered: true },
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
        { session, ordered: true },
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
        { session, ordered: true },
      );

      result = { success: true, message: "Referral applied successfully." };
    });
    return result;
  } catch (error) {
    const message = (error as { message?: string }).message;
    if (message === "INVALID_REFERRER") {
      return { success: false, message: "Referral code is invalid." };
    }
    if (message === "REFERRALS_INACTIVE") {
      return { success: false, message: "Referrals are not currently active." };
    }
    if (message === "REFERRAL_LIMIT_REACHED") {
      return { success: false, message: "This referral code has reached its usage limit." };
    }
    if (
      (error as { code?: number }).code === 11000 ||
      message === "ALREADY_REFERRED"
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
  referredUserId: string,
  tripId: string,
): Promise<boolean> {
  console.log(`[ReferralCheck] Trip completion check for referee [${referredUserId}], trip [${tripId}] — instant crediting active, skipped.`);
  return false;
}

/**
 * Reconciles a stuck pending ReferralUsage record by atomically crediting both wallets,
 * creating ledger transactions, generating notifications, and marking the status as "credited".
 * Guarded against double-crediting.
 */
export async function reconcileReferralUsage(
  referralUsageId: string | Types.ObjectId,
): Promise<{
  success: boolean;
  message: string;
  referrerNewBalance?: number;
  refereeNewBalance?: number;
  status?: string;
}> {
  await connectDB();

  if (!Types.ObjectId.isValid(referralUsageId)) {
    return { success: false, message: "Invalid referral usage ID." };
  }

  const usage = await ReferralUsage.findById(referralUsageId);
  if (!usage) {
    return { success: false, message: "Referral usage record not found." };
  }

  if (usage.status === "credited") {
    return {
      success: true,
      message: "Referral has already been credited.",
      status: "credited",
    };
  }

  const session = await mongoose.startSession();
  try {
    let result = {
      success: false,
      message: "Reconciliation failed.",
      referrerNewBalance: 0,
      refereeNewBalance: 0,
      status: "pending",
    };

    await session.withTransaction(async () => {
      const updatedUsage = await ReferralUsage.findOneAndUpdate(
        { _id: usage._id, status: "pending" },
        { $set: { status: "credited", creditedAt: new Date() } },
        { session, returnDocument: "after" },
      );

      if (!updatedUsage) {
        throw new Error("ALREADY_CREDITED");
      }

      const referrerWallet = await Wallet.findOneAndUpdate(
        { userId: usage.referrer },
        {
          $inc: {
            balanceEgp: usage.referrerBonusAmount,
            totalCreditedEgp: usage.referrerBonusAmount,
          },
          $set: { lastTransactionAt: new Date() },
        },
        { returnDocument: "after", upsert: true, session },
      ).lean();

      const refereeWallet = await Wallet.findOneAndUpdate(
        { userId: usage.referredUser },
        {
          $inc: {
            balanceEgp: usage.refereeBonusAmount,
            totalCreditedEgp: usage.refereeBonusAmount,
          },
          $set: { lastTransactionAt: new Date() },
        },
        { returnDocument: "after", upsert: true, session },
      ).lean();

      const referrerNewBalance =
        referrerWallet?.balanceEgp ?? usage.referrerBonusAmount;
      const refereeNewBalance =
        refereeWallet?.balanceEgp ?? usage.refereeBonusAmount;

      await WalletTransaction.create(
        [
          {
            userId: usage.referrer,
            type: "referral_bonus",
            amountEgp: usage.referrerBonusAmount,
            status: "completed",
            description: "Referral bonus (reconciled)",
            balanceAfterEgp: referrerNewBalance,
            referralUsageId: usage._id,
          },
          {
            userId: usage.referredUser,
            type: "referral_bonus",
            amountEgp: usage.refereeBonusAmount,
            status: "completed",
            description: "Welcome referral bonus (reconciled)",
            balanceAfterEgp: refereeNewBalance,
            referralUsageId: usage._id,
          },
        ],
        { session, ordered: true },
      );

      await Notification.create(
        [
          {
            userId: usage.referrer,
            type: "referral_bonus",
            title: "Referral bonus received",
            body: `Someone signed up with your referral code — your wallet is now ${referrerNewBalance} EGP (+${usage.referrerBonusAmount}).`,
            data: {
              amount: usage.referrerBonusAmount,
              newBalanceEgp: referrerNewBalance,
              referralUsageId: usage._id,
            },
          },
          {
            userId: usage.referredUser,
            type: "referral_bonus",
            title: "Welcome bonus credited",
            body: `Your referral bonus has been credited — your wallet is now ${refereeNewBalance} EGP (+${usage.refereeBonusAmount}).`,
            data: {
              amount: usage.refereeBonusAmount,
              newBalanceEgp: refereeNewBalance,
              referralUsageId: usage._id,
            },
          },
        ],
        { session, ordered: true },
      );

      result = {
        success: true,
        message: "Referral bonus successfully reconciled and credited.",
        referrerNewBalance,
        refereeNewBalance,
        status: "credited",
      };
    });

    return result;
  } catch (error: any) {
    if (error?.message === "ALREADY_CREDITED") {
      return {
        success: true,
        message: "Referral has already been credited.",
        status: "credited",
      };
    }
    console.error(
      `[ReferralReconciliationError] Failed for usage [${referralUsageId}] referrer [${usage.referrer}] referee [${usage.referredUser}]:`,
      error,
    );
    return {
      success: false,
      message: `Reconciliation failed: ${error?.message || "Unknown error"}`,
    };
  } finally {
    await session.endSession();
  }
}
