import { connectDB } from "@/lib/db/mongoose";
import { Wallet } from "@/models/Wallet";
import { WalletTransaction } from "@/models/WalletTransaction";
import { WithdrawalRequest } from "@/models/WithdrawalRequest";
import { Notification } from "@/models/Notification";
import { getAdminSettings } from "@/lib/cancellationPolicy";
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
    paymentId?: string;
    bookingId?: string;
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
      paymentId: opts.paymentId
        ? new Types.ObjectId(opts.paymentId)
        : undefined,
      bookingId: opts.bookingId
        ? new Types.ObjectId(opts.bookingId)
        : undefined,
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
        [
          {
            userId: uid,
            type: "earning",
            amountEgp,
            status: "pending",
            description: opts.description,
            tripId: tripOid,
          },
        ],
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

/**
 * Reserve wallet funds for an in-flight mixed payment. Atomic: succeeds only
 * when `balanceEgp - reservedBalanceEgp >= amount`. Writes a
 * `payment_reserved` ledger row (status: pending) so the reservation is
 * auditable. Returns the ledger row id + available balance after reserve.
 */
export async function reserveWallet(
  userId: string,
  amountEgp: number,
  opts: { description: string; paymentId: string; bookingId?: string },
): Promise<{ transactionId: string; availableEgp: number } | null> {
  await connectDB();
  const uid = new Types.ObjectId(userId);

  const wallet = await Wallet.findOneAndUpdate(
    {
      userId: uid,
      status: "active",
      $expr: {
        $gte: [
          {
            $subtract: [
              { $ifNull: ["$balanceEgp", 0] },
              { $ifNull: ["$reservedBalanceEgp", 0] },
            ],
          },
          amountEgp,
        ],
      },
    },
    {
      $inc: { reservedBalanceEgp: amountEgp },
      $set: { lastTransactionAt: new Date() },
    },
    { new: true },
  );
  if (!wallet) return null;

  const tx = await WalletTransaction.create({
    userId: uid,
    type: "payment_reserved",
    amountEgp,
    status: "pending",
    description: opts.description,
    balanceAfterEgp: wallet.balanceEgp,
    paymentId: new Types.ObjectId(opts.paymentId),
    bookingId: opts.bookingId ? new Types.ObjectId(opts.bookingId) : undefined,
  });

  return {
    transactionId: String(tx._id),
    availableEgp: wallet.balanceEgp - wallet.reservedBalanceEgp,
  };
}

/**
 * Capture (finalize) a wallet reservation. Debits balanceEgp AND decrements
 * reservedBalanceEgp in one atomic op, then writes a `payment_captured` row.
 * Idempotent when guarded by the reservation ledger row (updated to
 * `completed`). Returns the new balance.
 */
export async function captureReservation(
  reservationTxId: string,
  opts: { description: string; paymentId: string; bookingId?: string },
): Promise<number | null> {
  await connectDB();

  const reservation = await WalletTransaction.findOneAndUpdate(
    { _id: reservationTxId, type: "payment_reserved", status: "pending" },
    { $set: { status: "completed" } },
    { new: true },
  );
  if (!reservation) return null;

  const wallet = await Wallet.findOneAndUpdate(
    { userId: reservation.userId },
    {
      $inc: {
        balanceEgp: -reservation.amountEgp,
        reservedBalanceEgp: -reservation.amountEgp,
        totalDebitedEgp: reservation.amountEgp,
      },
      $set: { lastTransactionAt: new Date() },
    },
    { new: true },
  );
  if (!wallet) {
    // Restore reservation row for retry.
    await WalletTransaction.updateOne(
      { _id: reservationTxId },
      { $set: { status: "pending" } },
    );
    return null;
  }

  const captureTx = await WalletTransaction.create({
    userId: reservation.userId,
    type: "payment_captured",
    amountEgp: reservation.amountEgp,
    status: "completed",
    description: opts.description,
    balanceAfterEgp: wallet.balanceEgp,
    paymentId: new Types.ObjectId(opts.paymentId),
    bookingId: opts.bookingId ? new Types.ObjectId(opts.bookingId) : undefined,
  });

  return wallet.balanceEgp;

  // captureTx id can be looked up by callers via paymentId if needed.
  void captureTx;
}

/**
 * Release a wallet reservation (Kashier failed/cancelled/expired). Decrements
 * reservedBalanceEgp; balanceEgp is unaffected. Writes `payment_released`.
 */
export async function releaseReservation(
  reservationTxId: string,
  opts: { description: string; paymentId: string; bookingId?: string },
): Promise<boolean> {
  await connectDB();

  const reservation = await WalletTransaction.findOneAndUpdate(
    { _id: reservationTxId, type: "payment_reserved", status: "pending" },
    { $set: { status: "failed" } },
    { new: true },
  );
  if (!reservation) return false;

  const wallet = await Wallet.findOneAndUpdate(
    { userId: reservation.userId },
    {
      $inc: { reservedBalanceEgp: -reservation.amountEgp },
      $set: { lastTransactionAt: new Date() },
    },
    { new: true },
  );
  if (!wallet) return false;

  await WalletTransaction.create({
    userId: reservation.userId,
    type: "payment_released",
    amountEgp: reservation.amountEgp,
    status: "completed",
    description: opts.description,
    balanceAfterEgp: wallet.balanceEgp,
    paymentId: new Types.ObjectId(opts.paymentId),
    bookingId: opts.bookingId ? new Types.ObjectId(opts.bookingId) : undefined,
  });

  return true;
}

/**
 * Driver submits a withdrawal request. Holds requested amount against pendingWithdrawalAmount.
 */
export async function createWithdrawalRequest(
  userId: string,
  amountEgp: number,
  payoutMethod: "mobile_wallet" | "bank",
  payoutDestination: string,
) {
  await connectDB();
  const uid = new Types.ObjectId(userId);
  const settings = await getAdminSettings();

  const wallet = await getOrCreateWallet(userId);
  const reserve = wallet.reserveAmount ?? settings.walletReserveAmount ?? 200;
  const limit = wallet.withdrawalLimit ?? settings.defaultWithdrawalLimit ?? null;
  const pending = wallet.pendingWithdrawalAmount ?? 0;
  const withdrawable = Math.max(0, wallet.balanceEgp - reserve - pending);

  if (amountEgp <= 0) {
    throw new Error("Enter a valid amount.");
  }
  if (amountEgp > withdrawable) {
    throw new Error(
      `Amount exceeds your withdrawable balance. (Withdrawable: ${withdrawable} EGP)`,
    );
  }
  if (limit != null && amountEgp > limit) {
    throw new Error(
      `Amount exceeds your withdrawal limit of ${limit} EGP.`,
    );
  }

  const updatedWallet = await Wallet.findOneAndUpdate(
    {
      userId: uid,
      status: "active",
      $expr: {
        $gte: [
          {
            $subtract: [
              { $ifNull: ["$balanceEgp", 0] },
              {
                $add: [
                  reserve,
                  { $ifNull: ["$pendingWithdrawalAmount", 0] },
                ],
              },
            ],
          },
          amountEgp,
        ],
      },
    },
    {
      $inc: { pendingWithdrawalAmount: amountEgp },
      $set: { lastTransactionAt: new Date() },
    },
    { new: true },
  );

  if (!updatedWallet) {
    throw new Error("Insufficient withdrawable balance.");
  }

  const request = await WithdrawalRequest.create({
    driverId: uid,
    amountEgp,
    status: "pending",
    payoutMethod,
    payoutDestination,
    requestedAt: new Date(),
  });

  return { request, wallet: updatedWallet };
}

/**
 * Admin approves a withdrawal request. Debits balanceEgp & releases hold, logs transaction, sends notification.
 */
export async function approveWithdrawalRequest(
  requestId: string,
  adminUserId: string,
) {
  await connectDB();
  const reqOid = new Types.ObjectId(requestId);
  const adminOid = new Types.ObjectId(adminUserId);

  const request = await WithdrawalRequest.findById(reqOid);
  if (!request) {
    throw new Error("Withdrawal request not found.");
  }
  if (request.status !== "pending") {
    throw new Error("This request was already resolved.");
  }

  const wallet = await Wallet.findOne({ userId: request.driverId });
  if (!wallet) {
    throw new Error("Driver wallet not found.");
  }

  if (wallet.balanceEgp < request.amountEgp) {
    throw new Error(
      "Driver balance is no longer sufficient to approve this request.",
    );
  }

  const updatedWallet = await Wallet.findOneAndUpdate(
    {
      userId: request.driverId,
      balanceEgp: { $gte: request.amountEgp },
    },
    {
      $inc: {
        balanceEgp: -request.amountEgp,
        pendingWithdrawalAmount: -request.amountEgp,
        totalDebitedEgp: request.amountEgp,
      },
      $set: { lastTransactionAt: new Date() },
    },
    { new: true },
  );

  if (!updatedWallet) {
    throw new Error("Failed to debit wallet due to insufficient balance.");
  }

  await WalletTransaction.create({
    userId: request.driverId,
    type: "withdrawal",
    amountEgp: request.amountEgp,
    status: "completed",
    description: `Withdrawal to ${request.payoutDestination}`,
    balanceAfterEgp: updatedWallet.balanceEgp,
    payoutMethod: request.payoutMethod,
    payoutDestination: request.payoutDestination,
  });

  request.status = "approved";
  request.resolvedAt = new Date();
  request.resolvedBy = adminOid;
  await request.save();

  await Notification.create({
    userId: request.driverId,
    type: "withdrawal_approved",
    title: "Withdrawal Approved",
    body: `Your withdrawal request of ${request.amountEgp} EGP to ${request.payoutDestination} has been approved.`,
    data: { requestId: String(request._id), amountEgp: request.amountEgp },
  });

  return { request, wallet: updatedWallet };
}

/**
 * Admin rejects a withdrawal request with optional reason. Releases held amount.
 */
export async function rejectWithdrawalRequest(
  requestId: string,
  adminUserId: string,
  reason?: string,
) {
  await connectDB();
  const reqOid = new Types.ObjectId(requestId);
  const adminOid = new Types.ObjectId(adminUserId);

  const request = await WithdrawalRequest.findById(reqOid);
  if (!request) {
    throw new Error("Withdrawal request not found.");
  }
  if (request.status !== "pending") {
    throw new Error("This request was already resolved.");
  }

  const updatedWallet = await Wallet.findOneAndUpdate(
    { userId: request.driverId },
    {
      $inc: { pendingWithdrawalAmount: -request.amountEgp },
      $set: { lastTransactionAt: new Date() },
    },
    { new: true },
  );

  request.status = "rejected";
  request.resolvedAt = new Date();
  request.resolvedBy = adminOid;
  request.rejectionReason = reason || null;
  await request.save();

  await Notification.create({
    userId: request.driverId,
    type: "withdrawal_rejected",
    title: "Withdrawal Rejected",
    body: `Your withdrawal request of ${request.amountEgp} EGP was rejected.${reason ? ` Reason: ${reason}` : ""}`,
    data: { requestId: String(request._id), amountEgp: request.amountEgp, reason },
  });

  return { request, wallet: updatedWallet };
}

/**
 * Driver cancels their own pending withdrawal request. Releases held amount.
 */
export async function cancelWithdrawalRequest(
  requestId: string,
  driverUserId: string,
) {
  await connectDB();
  const reqOid = new Types.ObjectId(requestId);
  const driverOid = new Types.ObjectId(driverUserId);

  const request = await WithdrawalRequest.findOne({
    _id: reqOid,
    driverId: driverOid,
  });
  if (!request) {
    throw new Error("Withdrawal request not found.");
  }
  if (request.status !== "pending") {
    throw new Error("This request can no longer be cancelled.");
  }

  const updatedWallet = await Wallet.findOneAndUpdate(
    { userId: driverOid },
    {
      $inc: { pendingWithdrawalAmount: -request.amountEgp },
      $set: { lastTransactionAt: new Date() },
    },
    { new: true },
  );

  request.status = "cancelled";
  request.resolvedAt = new Date();
  await request.save();

  return { request, wallet: updatedWallet };
}
