import { connectDB } from "@/lib/db/mongoose";
import { AdminSettings } from "@/models/AdminSettings";

export interface CancellationTier {
  startTime: string; // "17:00"
  endTime: string; // "19:00"
  action: "free" | "blocked" | "ride_only";
  penaltyPercent: number;
}

export interface SettingsResult {
  walletReserveAmount: number;
  defaultWithdrawalLimit?: number | null;
  availabilityLockTime: string;
  cancellationTiers: CancellationTier[];
}

export const DEFAULT_ADMIN_SETTINGS: SettingsResult = {
  walletReserveAmount: 200,
  defaultWithdrawalLimit: null,
  availabilityLockTime: "17:00",
  cancellationTiers: [
    { startTime: "00:00", endTime: "17:00", action: "free", penaltyPercent: 0 },
    { startTime: "17:00", endTime: "19:00", action: "blocked", penaltyPercent: 0 },
    { startTime: "19:00", endTime: "21:00", action: "ride_only", penaltyPercent: 25 },
    { startTime: "21:00", endTime: "23:00", action: "ride_only", penaltyPercent: 50 },
    { startTime: "23:00", endTime: "23:59", action: "ride_only", penaltyPercent: 110 },
  ],
};

export async function getAdminSettings(): Promise<SettingsResult> {
  try {
    await connectDB();
    const doc = await AdminSettings.findOne().lean<SettingsResult>();
    if (!doc) {
      return DEFAULT_ADMIN_SETTINGS;
    }
    return {
      walletReserveAmount: doc.walletReserveAmount ?? 200,
      defaultWithdrawalLimit: doc.defaultWithdrawalLimit ?? null,
      availabilityLockTime: doc.availabilityLockTime ?? "17:00",
      cancellationTiers:
        doc.cancellationTiers && doc.cancellationTiers.length > 0
          ? doc.cancellationTiers
          : DEFAULT_ADMIN_SETTINGS.cancellationTiers,
    };
  } catch {
    return DEFAULT_ADMIN_SETTINGS;
  }
}

/**
 * Returns current date string ("YYYY-MM-DD") and time string ("HH:MM") in Cairo local time.
 */
export function getCairoNowParts(nowDate: Date = new Date()): {
  dateStr: string;
  timeStr: string;
} {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(nowDate);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  const dateStr = `${map.year}-${map.month}-${map.day}`;
  const hour = map.hour === "24" ? "00" : map.hour;
  const timeStr = `${hour}:${map.minute}`;

  return { dateStr, timeStr };
}

/**
 * Computes the cutoff date string (the day before the ride date).
 */
export function getCutoffDateStr(rideDateStr: string): string {
  const d = new Date(`${rideDateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split("T")[0];
}

/**
 * Checks whether a driver can create, edit, or delete Availability for a given date.
 * Availability editing is allowed strictly BEFORE the 5:00 PM cutoff on the day prior to the availability date.
 */
export function canModifyAvailability(
  availabilityDateStr: string,
  nowDate: Date = new Date(),
  lockTimeStr: string = "17:00",
): boolean {
  const cutoffDateStr = getCutoffDateStr(availabilityDateStr);
  const { dateStr: nowDateStr, timeStr: nowTimeStr } = getCairoNowParts(nowDate);

  if (nowDateStr < cutoffDateStr) {
    return true;
  }
  if (nowDateStr === cutoffDateStr) {
    return nowTimeStr < lockTimeStr;
  }
  // After cutoff date
  return false;
}

export interface CancellationTierEvaluation {
  action: "free" | "blocked" | "ride_only";
  penaltyPercent: number;
  tierLabel: "free" | "blocked" | "25" | "50" | "110";
}

/**
 * Evaluates the cancellation tier for a ride based on Cairo time.
 */
export function getCancellationTier(
  rideDateStr: string,
  nowDate: Date = new Date(),
  lockTimeStr: string = "17:00",
  tiers: CancellationTier[] = DEFAULT_ADMIN_SETTINGS.cancellationTiers,
): CancellationTierEvaluation {
  const cutoffDateStr = getCutoffDateStr(rideDateStr);
  const { dateStr: nowDateStr, timeStr: nowTimeStr } = getCairoNowParts(nowDate);

  // If cancelling before the cutoff date
  if (nowDateStr < cutoffDateStr) {
    return { action: "free", penaltyPercent: 0, tierLabel: "free" };
  }

  // If cancelling after the cutoff date (on the ride day or later)
  if (nowDateStr > cutoffDateStr) {
    return { action: "ride_only", penaltyPercent: 110, tierLabel: "110" };
  }

  // On the cutoff date itself:
  if (nowTimeStr < lockTimeStr) {
    return { action: "free", penaltyPercent: 0, tierLabel: "free" };
  }

  // Check matching tier for nowTimeStr
  for (const tier of tiers) {
    if (nowTimeStr >= tier.startTime && nowTimeStr < tier.endTime) {
      let label: "free" | "blocked" | "25" | "50" | "110" = "free";
      if (tier.action === "blocked") {
        label = "blocked";
      } else if (tier.action === "ride_only") {
        const p = String(tier.penaltyPercent);
        label = (p === "25" || p === "50" || p === "110" ? p : "110") as "25" | "50" | "110";
      }
      return {
        action: tier.action,
        penaltyPercent: tier.penaltyPercent,
        tierLabel: label,
      };
    }
  }

  // 23:00 onward
  return { action: "ride_only", penaltyPercent: 110, tierLabel: "110" };
}

/**
 * Calculates withdrawable wallet balance enforcing non-withdrawable reserve.
 */
export function computeWithdrawableBalance(
  balanceEgp: number,
  reserveAmount: number = 200,
  pendingWithdrawalAmount: number = 0,
): number {
  return Math.max(0, balanceEgp - reserveAmount - pendingWithdrawalAmount);
}
