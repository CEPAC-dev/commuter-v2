export type PickupPinAttemptState = {
  failedAttempts: number;
  lockedUntil?: Date | null;
};

export type PickupPinAttemptDecision =
  | { kind: "accepted"; failedAttempts: 0; lockedUntil: null }
  | { kind: "invalid"; failedAttempts: number; lockedUntil: null }
  | {
      kind: "locked";
      failedAttempts: number;
      lockedUntil: Date;
      lockoutStarted: boolean;
    };

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MILLISECONDS = 10 * 60 * 1000;

export function decidePickupPinAttempt(
  state: PickupPinAttemptState,
  pinMatches: boolean,
  now: Date,
): PickupPinAttemptDecision {
  const lockUntil = state.lockedUntil ?? null;
  if (lockUntil && lockUntil.getTime() > now.getTime()) {
    return {
      kind: "locked",
      failedAttempts: state.failedAttempts,
      lockedUntil: lockUntil,
      lockoutStarted: false,
    };
  }

  const failedAttempts =
    lockUntil && lockUntil.getTime() <= now.getTime()
      ? 0
      : Math.max(0, Math.floor(state.failedAttempts));
  if (pinMatches) {
    return { kind: "accepted", failedAttempts: 0, lockedUntil: null };
  }

  const nextFailedAttempts = failedAttempts + 1;
  if (nextFailedAttempts >= MAX_FAILED_ATTEMPTS) {
    return {
      kind: "locked",
      failedAttempts: nextFailedAttempts,
      lockedUntil: new Date(now.getTime() + LOCKOUT_MILLISECONDS),
      lockoutStarted: true,
    };
  }
  return {
    kind: "invalid",
    failedAttempts: nextFailedAttempts,
    lockedUntil: null,
  };
}
