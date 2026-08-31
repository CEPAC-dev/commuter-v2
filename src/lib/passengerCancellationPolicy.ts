import { connectDB } from "@/lib/db/mongoose";
import {
  AdminSettings,
  DEFAULT_PASSENGER_CANCELLATION_TIERS,
  type PassengerCancellationTierConfig,
} from "@/models/AdminSettings";
import { getCairoNowParts } from "@/lib/cancellationPolicy";

export type PassengerCancellationTier = PassengerCancellationTierConfig;

export interface EvaluationResult {
  allowed: boolean;
  tierLabel: string;
  refundPercent: number;
  penaltyPercent: number;
  refundAmount: number;
  retainedAmount: number;
  daysBefore: number;
  timeStr: string;
  message?: string;
}

/**
 * Calculates calendar day difference between pickup date and now in Cairo local time.
 * E.g., pickupDateStr = "2026-08-31", now in Cairo = "2026-08-29" => 2 days before.
 */
export function calendarDaysBeforeCairo(
  pickupDateStr: string,
  nowDate: Date = new Date(),
): { daysBefore: number; nowCairoDateStr: string; nowCairoTimeStr: string } {
  const { dateStr: nowCairoDateStr, timeStr: nowCairoTimeStr } =
    getCairoNowParts(nowDate);

  const t1 = new Date(`${pickupDateStr}T00:00:00Z`).getTime();
  const t2 = new Date(`${nowCairoDateStr}T00:00:00Z`).getTime();

  const diffDays = Math.round((t1 - t2) / (1000 * 60 * 60 * 24));
  return {
    daysBefore: diffDays,
    nowCairoDateStr,
    nowCairoTimeStr,
  };
}

/**
 * Evaluates the passenger cancellation tier for a trip on a given date and price.
 */
export function evaluatePassengerCancellationTier(
  pickupDateStr: string,
  priceEgp: number,
  nowDate: Date = new Date(),
  tiers: PassengerCancellationTier[] = DEFAULT_PASSENGER_CANCELLATION_TIERS,
): EvaluationResult {
  const { daysBefore, nowCairoTimeStr } = calendarDaysBeforeCairo(
    pickupDateStr,
    nowDate,
  );

  let matchedTier: PassengerCancellationTier | null = null;

  if (daysBefore <= 0) {
    matchedTier = tiers.find((t) => t.label === "same_day") || {
      daysBeforeMin: 0,
      daysBeforeMax: 0,
      refundPercent: 0,
      penaltyPercent: 100,
      blocked: false,
      label: "same_day",
    };
  } else if (daysBefore >= 4) {
    matchedTier = tiers.find((t) => t.label === "four_plus_days_before") || {
      daysBeforeMin: 4,
      daysBeforeMax: null,
      refundPercent: 95,
      penaltyPercent: 5,
      blocked: false,
      label: "four_plus_days_before",
    };
  } else if (daysBefore === 2 || daysBefore === 3) {
    matchedTier = tiers.find((t) => t.label === "two_to_three_days_before") || {
      daysBeforeMin: 2,
      daysBeforeMax: 3,
      refundPercent: 90,
      penaltyPercent: 10,
      blocked: false,
      label: "two_to_three_days_before",
    };
  } else if (daysBefore === 1) {
    let rule: "before_match" | "during_match" | "after_match" = "before_match";
    if (nowCairoTimeStr >= "17:00" && nowCairoTimeStr < "19:00") {
      rule = "during_match";
    } else if (nowCairoTimeStr >= "19:00") {
      rule = "after_match";
    }

    matchedTier = tiers.find(
      (t) => t.daysBeforeMin === 1 && t.timeOfDayRule === rule,
    ) || null;

    if (!matchedTier) {
      if (rule === "before_match") {
        matchedTier = {
          daysBeforeMin: 1,
          daysBeforeMax: 1,
          timeOfDayRule: "before_match",
          refundPercent: 75,
          penaltyPercent: 25,
          blocked: false,
          label: "day_before_pre_match",
        };
      } else if (rule === "during_match") {
        matchedTier = {
          daysBeforeMin: 1,
          daysBeforeMax: 1,
          timeOfDayRule: "during_match",
          refundPercent: 0,
          penaltyPercent: 100,
          blocked: true,
          label: "day_before_during_match",
        };
      } else {
        matchedTier = {
          daysBeforeMin: 1,
          daysBeforeMax: 1,
          timeOfDayRule: "after_match",
          refundPercent: 50,
          penaltyPercent: 50,
          blocked: false,
          label: "day_before_post_match",
        };
      }
    }
  }

  if (!matchedTier) {
    matchedTier = {
      daysBeforeMin: daysBefore,
      refundPercent: 0,
      penaltyPercent: 100,
      blocked: false,
      label: "unknown_tier",
    };
  }

  const isBlocked = !!matchedTier.blocked;
  const refundPercent = matchedTier.refundPercent;
  const penaltyPercent = matchedTier.penaltyPercent;
  const refundAmount = Math.round((priceEgp * refundPercent) / 100);
  const retainedAmount = Math.max(0, priceEgp - refundAmount);

  let message = "";
  if (isBlocked) {
    message =
      "Cancellation is not allowed during the driver matching window (5:00 PM–7:00 PM the day before pickup).";
  }

  return {
    allowed: !isBlocked,
    tierLabel: matchedTier.label,
    refundPercent,
    penaltyPercent,
    refundAmount,
    retainedAmount,
    daysBefore,
    timeStr: nowCairoTimeStr,
    message: message || undefined,
  };
}

/**
 * Gets passenger cancellation tiers from AdminSettings or defaults, then evaluates.
 */
export async function evaluateTripCancellation(
  pickupDateStr: string,
  priceEgp: number,
  nowDate: Date = new Date(),
): Promise<EvaluationResult> {
  try {
    await connectDB();
    const doc = await AdminSettings.findOne().lean();
    const tiers =
      doc?.passengerCancellationTiers && doc.passengerCancellationTiers.length > 0
        ? (doc.passengerCancellationTiers as PassengerCancellationTier[])
        : DEFAULT_PASSENGER_CANCELLATION_TIERS;

    return evaluatePassengerCancellationTier(
      pickupDateStr,
      priceEgp,
      nowDate,
      tiers,
    );
  } catch {
    return evaluatePassengerCancellationTier(
      pickupDateStr,
      priceEgp,
      nowDate,
      DEFAULT_PASSENGER_CANCELLATION_TIERS,
    );
  }
}
