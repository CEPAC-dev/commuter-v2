export interface PassengerCancellationTierConfig {
  daysBeforeMin: number;
  daysBeforeMax?: number | null;
  timeOfDayRule?: "before_match" | "during_match" | "after_match" | null;
  refundPercent: number;
  penaltyPercent: number;
  blocked?: boolean;
  label: string;
}

export const DEFAULT_PASSENGER_CANCELLATION_TIERS: PassengerCancellationTierConfig[] = [
  {
    daysBeforeMin: 4,
    daysBeforeMax: null,
    timeOfDayRule: null,
    refundPercent: 95,
    penaltyPercent: 5,
    blocked: false,
    label: "four_plus_days_before",
  },
  {
    daysBeforeMin: 2,
    daysBeforeMax: 3,
    timeOfDayRule: null,
    refundPercent: 90,
    penaltyPercent: 10,
    blocked: false,
    label: "two_to_three_days_before",
  },
  {
    daysBeforeMin: 1,
    daysBeforeMax: 1,
    timeOfDayRule: "before_match",
    refundPercent: 75,
    penaltyPercent: 25,
    blocked: false,
    label: "day_before_pre_match",
  },
  {
    daysBeforeMin: 1,
    daysBeforeMax: 1,
    timeOfDayRule: "during_match",
    refundPercent: 0,
    penaltyPercent: 100,
    blocked: true,
    label: "day_before_during_match",
  },
  {
    daysBeforeMin: 1,
    daysBeforeMax: 1,
    timeOfDayRule: "after_match",
    refundPercent: 50,
    penaltyPercent: 50,
    blocked: false,
    label: "day_before_post_match",
  },
  {
    daysBeforeMin: 0,
    daysBeforeMax: 0,
    timeOfDayRule: null,
    refundPercent: 0,
    penaltyPercent: 100,
    blocked: false,
    label: "same_day",
  },
];
