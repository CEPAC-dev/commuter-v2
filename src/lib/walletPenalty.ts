import type { PipelineStage, Types } from "mongoose";

type WalletMoneyInput = {
  balanceEgp: number;
  owedEgp: number;
};

function toPiasters(value: number, field: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${field} must be a finite non-negative amount.`);
  }
  const piasters = Math.round((value + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(piasters)) {
    throw new RangeError(`${field} is too large.`);
  }
  return piasters;
}

function egp(piasters: number): number {
  return piasters / 100;
}

export function buildPenaltyWalletUpdate(
  userId: Types.ObjectId,
  penaltyEgp: number,
  appliedAt: Date,
): PipelineStage[] {
  const penalty = egp(toPiasters(penaltyEgp, "penaltyEgp"));
  if (penalty <= 0) {
    throw new RangeError("penaltyEgp must be greater than zero.");
  }

  const balance = { $ifNull: ["$balanceEgp", 0] };
  const newBalance = { $max: [0, { $subtract: [balance, penalty] }] };
  const deducted = { $min: [balance, penalty] };
  const shortfall = { $max: [0, { $subtract: [penalty, balance] }] };

  return [
    {
      $set: {
        userId,
        balanceEgp: newBalance,
        owedEgp: {
          $add: [{ $ifNull: ["$owedEgp", 0] }, shortfall],
        },
        totalDebitedEgp: {
          $add: [{ $ifNull: ["$totalDebitedEgp", 0] }, deducted],
        },
        totalCreditedEgp: { $ifNull: ["$totalCreditedEgp", 0] },
        pendingWithdrawalAmount: {
          $ifNull: ["$pendingWithdrawalAmount", 0],
        },
        reservedBalanceEgp: { $ifNull: ["$reservedBalanceEgp", 0] },
        status: { $ifNull: ["$status", "active"] },
        lastTransactionAt: appliedAt,
      },
    },
  ];
}

export function computePenaltyApplication({
  balanceEgp,
  owedEgp,
  penaltyEgp,
}: WalletMoneyInput & { penaltyEgp: number }) {
  const balance = toPiasters(balanceEgp, "balanceEgp");
  const owed = toPiasters(owedEgp, "owedEgp");
  const penalty = toPiasters(penaltyEgp, "penaltyEgp");
  const deducted = Math.min(balance, penalty);
  const addedDebt = penalty - deducted;

  return {
    deductedEgp: egp(deducted),
    newBalanceEgp: egp(balance - deducted),
    addedDebtEgp: egp(addedDebt),
    newOwedEgp: egp(owed + addedDebt),
  };
}

export function applyEarningWithDebt({
  balanceEgp,
  owedEgp,
  earningEgp,
}: WalletMoneyInput & { earningEgp: number }) {
  const balance = toPiasters(balanceEgp, "balanceEgp");
  const owed = toPiasters(owedEgp, "owedEgp");
  const earning = toPiasters(earningEgp, "earningEgp");
  const repaid = Math.min(owed, earning);

  return {
    repaidEgp: egp(repaid),
    newBalanceEgp: egp(balance + earning - repaid),
    newOwedEgp: egp(owed - repaid),
  };
}

export function computeWithdrawable({
  balanceEgp,
  owedEgp,
  reserveEgp,
}: WalletMoneyInput & { reserveEgp: number }): number {
  const balance = toPiasters(balanceEgp, "balanceEgp");
  const owed = toPiasters(owedEgp, "owedEgp");
  const reserve = toPiasters(reserveEgp, "reserveEgp");
  return owed > 0 ? 0 : egp(Math.max(0, balance - reserve));
}
