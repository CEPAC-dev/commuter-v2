export const DEFAULT_NO_SHOW_MIN_WAIT_MINUTES = 5;

function readMinWaitMinutes(value: string | undefined): number {
  if (value === undefined) return DEFAULT_NO_SHOW_MIN_WAIT_MINUTES;
  if (!/^[1-9]\d*$/.test(value)) {
    throw new RangeError("NO_SHOW_MIN_WAIT_MINUTES must be a positive integer.");
  }
  const minutes = Number(value);
  if (!Number.isSafeInteger(minutes)) {
    throw new RangeError("NO_SHOW_MIN_WAIT_MINUTES must be a positive integer.");
  }
  return minutes;
}

export const NO_SHOW_MIN_WAIT_MINUTES = readMinWaitMinutes(
  process.env.NO_SHOW_MIN_WAIT_MINUTES,
);

export type NoShowWaitDecision =
  | { allowed: true; remainingSeconds: 0 }
  | { allowed: false; remainingSeconds: number };

export function canMarkNoShow(input: {
  arrivedAt: Date | string | null | undefined;
  now: Date;
  minWaitMinutes: number;
}): NoShowWaitDecision {
  if (
    !Number.isSafeInteger(input.minWaitMinutes) ||
    input.minWaitMinutes <= 0
  ) {
    throw new RangeError("minWaitMinutes must be a positive integer.");
  }
  const nowMs = input.now.getTime();
  if (!Number.isFinite(nowMs)) throw new RangeError("now must be a valid date.");

  const arrivedAtMs =
    input.arrivedAt instanceof Date
      ? input.arrivedAt.getTime()
      : typeof input.arrivedAt === "string"
        ? Date.parse(input.arrivedAt)
        : Number.NaN;
  const waitMs = input.minWaitMinutes * 60_000;
  const remainingMs = Number.isFinite(arrivedAtMs)
    ? arrivedAtMs + waitMs - nowMs
    : waitMs;
  if (remainingMs <= 0) return { allowed: true, remainingSeconds: 0 };
  return {
    allowed: false,
    remainingSeconds: Math.ceil(remainingMs / 1000),
  };
}
