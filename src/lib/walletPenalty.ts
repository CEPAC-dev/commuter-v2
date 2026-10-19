import type { PipelineStage, Types } from "mongoose";

const MAX_WALLET_AMOUNT_EGP = 1_000_000_000;

type WalletMoneyInput = {
  balanceEgp: number;
  owedEgp: number;
};

export type WalletAdjustmentType = "waive_debt" | "refund_penalty";

export function isAdminWalletAdjustmentAuthorized(role: unknown): boolean {
  return role === "admin";
}

export function computeWalletAdjustment({
  type,
  balanceEgp,
  owedEgp,
  amountEgp,
}: WalletMoneyInput & {
  type: WalletAdjustmentType;
  amountEgp: number;
}) {
  const balance = toPiasters(balanceEgp, "balanceEgp");
  const owed = toPiasters(owedEgp, "owedEgp");
  const amount = toPiasters(amountEgp, "amountEgp");
  if (amount <= 0) {
    throw new RangeError("amountEgp must be greater than zero.");
  }
  if (amountEgp > MAX_WALLET_AMOUNT_EGP) {
    throw new RangeError("amountEgp exceeds the wallet limit.");
  }

  if (type === "waive_debt") {
    const waived = Math.min(owed, amount);
    return {
      appliedAmountEgp: egp(waived),
      debtReductionEgp: egp(waived),
      balanceCreditEgp: 0,
      newBalanceEgp: egp(balance),
      newOwedEgp: egp(owed - waived),
    };
  }

  const debtReduction = Math.min(owed, amount);
  const balanceCredit = amount - debtReduction;
  if (balance + balanceCredit > MAX_WALLET_AMOUNT_EGP * 100) {
    throw new RangeError("Wallet balance would exceed the wallet limit.");
  }
  return {
    appliedAmountEgp: egp(amount),
    debtReductionEgp: egp(debtReduction),
    balanceCreditEgp: egp(balanceCredit),
    newBalanceEgp: egp(balance + balanceCredit),
    newOwedEgp: egp(owed - debtReduction),
  };
}

export function buildAdminWalletAdjustmentUpdate(
  userId: Types.ObjectId,
  adjustment: { newBalanceEgp: number; newOwedEgp: number; balanceCreditEgp: number },
  appliedAt: Date,
): PipelineStage[] {
  return [
    {
      $set: {
        userId,
        balanceEgp: adjustment.newBalanceEgp,
        owedEgp: adjustment.newOwedEgp,
        totalCreditedEgp: {
          $add: [
            { $ifNull: ["$totalCreditedEgp", 0] },
            adjustment.balanceCreditEgp,
          ],
        },
        totalDebitedEgp: { $ifNull: ["$totalDebitedEgp", 0] },
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

export function buildEarningWalletUpdate(
  userId: Types.ObjectId,
  earningEgp: number,
  appliedAt: Date,
): PipelineStage[] {
  const earning = egp(toPiasters(earningEgp, "earningEgp"));
  if (earning <= 0) {
    throw new RangeError("earningEgp must be greater than zero.");
  }

  const owed = { $ifNull: ["$owedEgp", 0] };
  const repaid = { $min: [owed, earning] };

  return [
    {
      $set: {
        userId,
        balanceEgp: {
          $add: [
            { $ifNull: ["$balanceEgp", 0] },
            { $subtract: [earning, repaid] },
          ],
        },
        owedEgp: { $max: [0, { $subtract: [owed, earning] }] },
        totalCreditedEgp: {
          $add: [{ $ifNull: ["$totalCreditedEgp", 0] }, earning],
        },
        totalDebitedEgp: {
          $add: [{ $ifNull: ["$totalDebitedEgp", 0] }, repaid],
        },
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
