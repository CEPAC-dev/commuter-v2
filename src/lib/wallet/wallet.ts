import { connectDB } from "@/lib/db/mongoose";
import { Wallet } from "@/models/Wallet";
import { WalletTransaction } from "@/models/WalletTransaction";
import mongoose, { Types } from "mongoose";

/** Ensure a wallet doc exists for the user and return it. */
export async function getOrCreateWallet(userId: string) {
  await connectDB();
  const uid = new Types.ObjectId(userId);
  let wallet = await Wallet.findOne({ userId: uid });
  if (!wallet) {
    wallet = await Wallet.create({ userId: uid, balanceEgp: 0 });
  }
  return wallet;
}

/**
 * Credit funds to a wallet atomically and write a completed ledger entry.
 * Used when a top-up is confirmed paid.
 */
export async function creditWallet(
  userId: string,
  amountEgp: number,
  opts: {
    description: string;
    transactionId?: string;
    type?: "topup" | "refund";
  } = {
    description: "Wallet top-up",
  },
): Promise<number> {
  await connectDB();
  const uid = new Types.ObjectId(userId);

  const wallet = await Wallet.findOneAndUpdate(
    { userId: uid },
    {
      $inc: { balanceEgp: amountEgp, totalCreditedEgp: amountEgp },
      $set: { lastTransactionAt: new Date() },
    },
    { new: true, upsert: true },
  );

  if (opts.transactionId) {
    // Mark the existing pending top-up ledger row as completed.
    await WalletTransaction.findByIdAndUpdate(opts.transactionId, {
      status: "completed",
      balanceAfterEgp: wallet.balanceEgp,
    });
  } else {
    await WalletTransaction.create({
      userId: uid,
      type: opts.type ?? "topup",
      amountEgp,
      status: "completed",
      description: opts.description,
      balanceAfterEgp: wallet.balanceEgp,
    });
  }

  return wallet.balanceEgp;
}

/**
 * Debit funds from a wallet atomically. The conditional filter
 * (`balanceEgp >= amount`) makes the deduction race-safe without a transaction:
 * if two requests race, only one matches and decrements. Returns the new
 * balance, or null when the balance is insufficient (no change made).
 */
export async function debitWallet(
  userId: string,
  amountEgp: number,
  opts: { description: string; bookingId?: string },
): Promise<number | null> {
  await connectDB();
  const uid = new Types.ObjectId(userId);

  const wallet = await Wallet.findOneAndUpdate(
    { userId: uid, status: "active", balanceEgp: { $gte: amountEgp } },
    {
      $inc: { balanceEgp: -amountEgp, totalDebitedEgp: amountEgp },
      $set: { lastTransactionAt: new Date() },
    },
    { new: true },
  );

  if (!wallet) return null;

  await WalletTransaction.create({
    userId: uid,
    type: "payment",
    amountEgp,
    status: "completed",
    description: opts.description,
    balanceAfterEgp: wallet.balanceEgp,
    bookingId: opts.bookingId ? new Types.ObjectId(opts.bookingId) : undefined,
  });

  return wallet.balanceEgp;
}

/**
 * Credit a driver after a completed trip. Idempotent when `tripId` is supplied.
 */
export async function creditDriverEarning(
  userId: string,
  amountEgp: number,
  opts: { description: string; tripId: string },
): Promise<number | null> {
  await connectDB();
  const uid = new Types.ObjectId(userId);
  const tripOid = new Types.ObjectId(opts.tripId);
  const session = await mongoose.startSession();
  let balance: number | null = null;

  try {
    await session.withTransaction(async () => {
      const [ledger] = await WalletTransaction.create(
        [{
          userId: uid,
          type: "earning",
          amountEgp,
          status: "pending",
          description: opts.description,
          tripId: tripOid,
        }],
        { session },
      );

      const wallet = await Wallet.findOneAndUpdate(
        { userId: uid },
        {
          $inc: { balanceEgp: amountEgp, totalCreditedEgp: amountEgp },
          $set: { lastTransactionAt: new Date() },
        },
        { new: true, upsert: true, session },
      );

      const settled = await WalletTransaction.findOneAndUpdate(
        { _id: ledger._id, status: "pending" },
        { $set: { status: "completed", balanceAfterEgp: wallet.balanceEgp } },
        { new: true, session },
      );
      if (!settled) throw new Error("Earning ledger claim failed");
      balance = wallet.balanceEgp;
    });
    return balance;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    ) {
      const existing = await WalletTransaction.findOne({
        userId: uid,
        type: "earning",
        tripId: tripOid,
        status: "completed",
      }).select("balanceAfterEgp");
      return existing?.balanceAfterEgp ?? null;
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

/** Reserve funds for a driver withdrawal (pending until Kashier confirms). */
export async function reserveWithdrawal(
  userId: string,
  amountEgp: number,
  opts: {
    description: string;
    payoutMethod: "mobile_wallet" | "bank";
    payoutDestination: string;
  },
): Promise<{ transactionId: string; balanceAfterEgp: number } | null> {
  await connectDB();
  const uid = new Types.ObjectId(userId);

  const wallet = await Wallet.findOneAndUpdate(
    { userId: uid, status: "active", balanceEgp: { $gte: amountEgp } },
    {
      $inc: { balanceEgp: -amountEgp, totalDebitedEgp: amountEgp },
      $set: { lastTransactionAt: new Date() },
    },
    { new: true },
  );
  if (!wallet) return null;

  const tx = await WalletTransaction.create({
    userId: uid,
    type: "withdrawal",
    amountEgp,
    status: "pending",
    description: opts.description,
    balanceAfterEgp: wallet.balanceEgp,
    payoutMethod: opts.payoutMethod,
    payoutDestination: opts.payoutDestination,
  });

  return {
    transactionId: String(tx._id),
    balanceAfterEgp: wallet.balanceEgp,
  };
}

export async function completeWithdrawal(
  transactionId: string,
  kashierPayoutId?: string,
): Promise<boolean> {
  await connectDB();
  const update: Record<string, unknown> = { status: "completed" };
  if (kashierPayoutId) update.kashierPayoutId = kashierPayoutId;

  const tx = await WalletTransaction.findOneAndUpdate(
    { _id: transactionId, type: "withdrawal", status: "pending" },
    update,
  );
  return Boolean(tx);
}

export async function refundWithdrawal(
  transactionId: string,
): Promise<boolean> {
  await connectDB();
  const session = await mongoose.startSession();
  let refunded = false;

  try {
    await session.withTransaction(async () => {
      const tx = await WalletTransaction.findOneAndUpdate(
        { _id: transactionId, type: "withdrawal", status: "pending" },
        { $set: { status: "failed" } },
        { new: true, session },
      );
      if (!tx) return;

      const wallet = await Wallet.findOneAndUpdate(
        { userId: tx.userId },
        {
          $inc: { balanceEgp: tx.amountEgp, totalDebitedEgp: -tx.amountEgp },
          $set: { lastTransactionAt: new Date() },
        },
        { new: true, session },
      );
      if (!wallet) throw new Error("Withdrawal wallet not found");

      await WalletTransaction.updateOne(
        { _id: tx._id, status: "failed" },
        { $set: { balanceAfterEgp: wallet.balanceEgp } },
        { session },
      );
      refunded = true;
    });
    return refunded;
  } finally {
    await session.endSession();
  }
}
