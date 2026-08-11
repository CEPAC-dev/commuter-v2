import "server-only";
import { randomBytes } from "crypto";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { ReferralSettings } from "@/models/ReferralSettings";
import { ReferralUsage } from "@/models/ReferralUsage";
import { Trip } from "@/models/Trip";
import { User } from "@/models/User";

const REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const MAX_CODE_ATTEMPTS = 10;

export interface ReferralResult {
  success: boolean;
  message: string;
}

export interface ActiveReferralDiscount {
  usageId: string;
  discountPercentage: number;
}

export interface ReferralDiscountAvailability {
  referralDiscountAvailable: boolean;
  referralDiscountPercentage: number | null;
  referralDiscountTripsRemaining: number;
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
      discountPercentage: settings.discountPercentage,
      tripsRemaining: settings.discountValidForTrips,
      status: settings.discountValidForTrips > 0 ? "active" : "exhausted",
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

export async function getActiveDiscountForUser(
  userId: string | Types.ObjectId,
): Promise<ActiveReferralDiscount | null> {
  await connectDB();
  if (!Types.ObjectId.isValid(userId)) return null;

  const usage = await ReferralUsage.findOne({
    referrer: userId,
    status: "active",
    tripsRemaining: { $gt: 0 },
  })
    .sort({ createdAt: 1, _id: 1 })
    .select("discountPercentage")
    .lean();

  return usage
    ? { usageId: String(usage._id), discountPercentage: usage.discountPercentage }
    : null;
}

export async function consumeReferralUsage(
  usageId: string | Types.ObjectId,
): Promise<boolean> {
  await connectDB();
  if (!Types.ObjectId.isValid(usageId)) return false;

  const usage = await ReferralUsage.findOneAndUpdate(
    { _id: usageId, status: "active", tripsRemaining: { $gt: 0 } },
    [
      {
        $set: {
          tripsRemaining: { $subtract: ["$tripsRemaining", 1] },
          status: {
            $cond: [{ $lte: ["$tripsRemaining", 1] }, "exhausted", "active"],
          },
        },
      },
    ],
    { returnDocument: "after" },
  );

  return Boolean(usage);
}

export async function getReferralDiscountAvailability(
  userId: string | Types.ObjectId,
): Promise<ReferralDiscountAvailability> {
  await connectDB();
  if (!Types.ObjectId.isValid(userId)) {
    return {
      referralDiscountAvailable: false,
      referralDiscountPercentage: null,
      referralDiscountTripsRemaining: 0,
    };
  }

  const usages = await ReferralUsage.find({
    referrer: userId,
    status: "active",
    tripsRemaining: { $gt: 0 },
  })
    .sort({ createdAt: 1, _id: 1 })
    .select("discountPercentage tripsRemaining")
    .lean();
  if (usages.length === 0) {
    return {
      referralDiscountAvailable: false,
      referralDiscountPercentage: null,
      referralDiscountTripsRemaining: 0,
    };
  }

  const usageIds = usages.map((usage) => usage._id);
  const reservations = await Trip.aggregate<{ _id: Types.ObjectId; count: number }>([
    {
      $match: {
        referralUsageId: { $in: usageIds },
        referralUsageConsumedAt: null,
        status: { $nin: ["cancelled", "time_out"] },
      },
    },
    { $group: { _id: "$referralUsageId", count: { $sum: 1 } } },
  ]);
  const reservedByUsage = new Map(
    reservations.map((reservation) => [String(reservation._id), reservation.count]),
  );

  let remaining = 0;
  for (const usage of usages) {
    remaining += Math.max(
      0,
      usage.tripsRemaining - (reservedByUsage.get(String(usage._id)) ?? 0),
    );
  }

  return {
    referralDiscountAvailable: remaining > 0,
    referralDiscountPercentage: remaining > 0 ? usages[0].discountPercentage : null,
    referralDiscountTripsRemaining: remaining,
  };
}

export async function getReferralDiscountAllocations(
  userId: string | Types.ObjectId,
  tripCount: number,
): Promise<ActiveReferralDiscount[]> {
  await connectDB();
  if (!Types.ObjectId.isValid(userId) || tripCount <= 0) return [];

  const usages = await ReferralUsage.find({
    referrer: userId,
    status: "active",
    tripsRemaining: { $gt: 0 },
  })
    .sort({ createdAt: 1, _id: 1 })
    .select("discountPercentage tripsRemaining")
    .lean();
  if (usages.length === 0) return [];

  const usageIds = usages.map((usage) => usage._id);
  const reservations = await Trip.aggregate<{ _id: Types.ObjectId; count: number }>([
    {
      $match: {
        referralUsageId: { $in: usageIds },
        referralUsageConsumedAt: null,
        status: { $nin: ["cancelled", "time_out"] },
      },
    },
    { $group: { _id: "$referralUsageId", count: { $sum: 1 } } },
  ]);
  const reservedByUsage = new Map(
    reservations.map((reservation) => [String(reservation._id), reservation.count]),
  );

  const allocations: ActiveReferralDiscount[] = [];
  for (const usage of usages) {
    const available = Math.max(
      0,
      usage.tripsRemaining - (reservedByUsage.get(String(usage._id)) ?? 0),
    );
    for (let index = 0; index < available && allocations.length < tripCount; index += 1) {
      allocations.push({
        usageId: String(usage._id),
        discountPercentage: usage.discountPercentage,
      });
    }
    if (allocations.length === tripCount) break;
  }

  return allocations;
}

export async function consumeReferralForCompletedTrip(
  tripId: string | Types.ObjectId,
): Promise<boolean> {
  await connectDB();
  if (!Types.ObjectId.isValid(tripId)) return false;

  const consumedAt = new Date();
  const trip = await Trip.findOneAndUpdate(
    {
      _id: tripId,
      status: "completed",
      paymentStatus: "paid",
      referralUsageId: { $ne: null },
      referralUsageConsumedAt: null,
    },
    { $set: { referralUsageConsumedAt: consumedAt } },
    { returnDocument: "before" },
  )
    .select("referralUsageId")
    .lean<{ referralUsageId?: Types.ObjectId | null }>();

  if (!trip?.referralUsageId) return false;
  const consumed = await consumeReferralUsage(trip.referralUsageId);
  if (!consumed) {
    await Trip.updateOne(
      { _id: tripId, referralUsageConsumedAt: consumedAt },
      { $set: { referralUsageConsumedAt: null } },
    );
  }
  return consumed;
}