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
import { User } from "@/models/User";
import { Wallet } from "@/models/Wallet";
import { WalletTransaction } from "@/models/WalletTransaction";
import { ReferralAuditLog } from "@/models/ReferralAuditLog";
import { AdminReferralCampaign, type AdminReferralRole } from "@/models/AdminReferralCampaign";
import { AdminReferralUsage } from "@/models/AdminReferralUsage";
import { AdminReferralAuditLog } from "@/models/AdminReferralAuditLog";

const REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_CODE_ATTEMPTS = 10;

export function generateAdminReferralToken(): string {
  const bytes = randomBytes(6);
  const suffix = Array.from(bytes, (byte) => REFERRAL_ALPHABET[byte % REFERRAL_ALPHABET.length]).join("");
  return `INVITATION-${suffix}`;
}

export async function getOrCreateAdminReferralCampaign(
  role: AdminReferralRole,
  actorId: string | Types.ObjectId,
) {
  await connectDB();
  const existing = await AdminReferralCampaign.findOne({ role });
  if (existing) return existing;
  return AdminReferralCampaign.create({
    role,
    token: generateAdminReferralToken(),
    rewardAmount: 100,
    maxUses: 5,
    isActive: false,
    createdBy: actorId,
  });
}

export interface ReferralResult {
  success: boolean;
  message: string;
}

async function creditReferralWallet(
  session: mongoose.ClientSession,
  userId: Types.ObjectId,
  amountEgp: number,
  description: string,
  reference: { referralUsageId?: Types.ObjectId; adminReferralUsageId?: Types.ObjectId },
) {
  const wallet = await Wallet.findOneAndUpdate(
    { userId },
    {
      $inc: { balanceEgp: amountEgp, totalCreditedEgp: amountEgp },
      $set: { lastTransactionAt: new Date() },
    },
    { returnDocument: "after", upsert: true, session },
  ).lean();
  const balance = wallet?.balanceEgp ?? amountEgp;

  await WalletTransaction.create(
    [{
      userId,
      type: "referral_bonus",
      amountEgp,
      status: "completed",
      description,
      balanceAfterEgp: balance,
      ...reference,
    }],
    { session, ordered: true },
  );

  return balance;
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

  const referredUserId = new Types.ObjectId(String(newUserId));
  const normalizedCode = referralCode.trim().toUpperCase();
  const adminCampaign = await AdminReferralCampaign.findOne({ token: normalizedCode }).lean();
  if (adminCampaign) {
    return applyAdminReferralOnSignup(adminCampaign._id, referredUserId);
  }

  const referrer = await User.findOne({ referralCode: normalizedCode })
    .select("_id name userNumber phone")
    .lean();
  if (!referrer) {
    return { success: false, message: "Referral code is invalid." };
  }

  if (String(referrer._id) === String(referredUserId)) {
    return { success: false, message: "You cannot use your own referral code." };
  }

  const referredUser = await User.findById(referredUserId)
    .select("referredBy referralClaimedAt name userNumber phone")
    .lean();
  if (!referredUser || referredUser.referredBy || referredUser.referralClaimedAt) {
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
        { _id: referredUserId, referredBy: null, referralClaimedAt: null },
        { $set: { referredBy: referrer._id, referralClaimedAt: new Date(), referralClaimType: "user" } },
        { session },
      );
      if (updated.modifiedCount !== 1) {
        throw new Error("ALREADY_REFERRED");
      }

      // 3. Credit both wallets and write the completed ledger entries.
      const referrerNewBalance = await creditReferralWallet(
        session,
        referrer._id,
        settings.referrerBonusAmount,
        "Referral bonus",
        { referralUsageId: usage._id },
      );
      const refereeNewBalance = await creditReferralWallet(
        session,
        referredUserId,
        settings.refereeBonusAmount,
        "Welcome referral bonus",
        { referralUsageId: usage._id },
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

      await ReferralAuditLog.create(
        [
          {
            eventType: "referral_added",
            actorId: referrer._id,
            targetUserId: referredUserId,
            actorSnapshot: {
              name: referrer.name ?? "Unknown user",
              userNumber: referrer.userNumber ?? null,
              phone: referrer.phone ?? "",
            },
            targetSnapshot: {
              name: referredUser.name ?? "Unknown user",
              userNumber: referredUser.userNumber ?? null,
              phone: referredUser.phone ?? "",
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

async function applyAdminReferralOnSignup(
  campaignId: Types.ObjectId,
  referredUserId: Types.ObjectId,
): Promise<ReferralResult> {
  const session = await mongoose.startSession();
  try {
    let result: ReferralResult = { success: false, message: "Referral failed." };
    await session.withTransaction(async () => {
      const recipient = await User.findOneAndUpdate(
        { _id: referredUserId, referredBy: null, referralClaimedAt: null },
        { $set: { referralClaimedAt: new Date(), referralClaimType: "admin_campaign" } },
        { returnDocument: "after", session },
      ).select("_id name userNumber phone").lean();
      if (!recipient) throw new Error("ALREADY_REFERRED");

      const campaign = await AdminReferralCampaign.findOneAndUpdate(
        {
          _id: campaignId,
          isActive: true,
          $or: [{ maxUses: null }, { $expr: { $lt: ["$usedCount", "$maxUses"] } }],
        },
        { $inc: { usedCount: 1 } },
        { returnDocument: "after", session },
      ).lean();
      if (!campaign) throw new Error("ADMIN_REFERRAL_UNAVAILABLE");

      const usage = await AdminReferralUsage.create(
        [{ campaignId, recipientUserId: referredUserId, rewardAmount: campaign.rewardAmount, status: "credited" }],
        { session, ordered: true },
      );
      const balance = await creditReferralWallet(
        session,
        referredUserId,
        campaign.rewardAmount,
        "Admin referral welcome bonus",
        { adminReferralUsageId: usage[0]._id },
      );
      await Notification.create(
        [{ userId: referredUserId, type: "referral_bonus", title: "Welcome bonus credited", body: `Your welcome bonus has been credited — your wallet is now ${balance} EGP (+${campaign.rewardAmount}).`, data: { amount: campaign.rewardAmount, newBalanceEgp: balance, adminReferralUsageId: usage[0]._id } }],
        { session, ordered: true },
      );

      const creator = await User.findById(campaign.createdBy).select("name userNumber phone").session(session).lean();
      if (creator) {
        await AdminReferralAuditLog.create(
          [{ campaignId, eventType: "redeemed", actorId: creator._id, recipientUserId: recipient._id, actorSnapshot: { name: creator.name, userNumber: creator.userNumber ?? null, phone: creator.phone }, recipientSnapshot: { name: recipient.name, userNumber: recipient.userNumber ?? null, phone: recipient.phone }, metadata: { rewardAmount: campaign.rewardAmount } }],
          { session, ordered: true },
        );
      }
      result = { success: true, message: "Referral applied successfully." };
    });
    return result;
  } catch (error) {
    const message = (error as { message?: string }).message;
    if (message === "ALREADY_REFERRED") return { success: false, message: "This account already used a referral code." };
    if (message === "ADMIN_REFERRAL_UNAVAILABLE") return { success: false, message: "This admin referral link is inactive or has reached its usage limit." };
    console.error("Admin referral application failed:", error);
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "ALREADY_CREDITED") {
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
      message: `Reconciliation failed: ${message}`,
    };
  } finally {
    await session.endSession();
  }
}
