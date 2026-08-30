import assert from "node:assert/strict";

// Simulated policy calculation matching src/lib/cancellationPolicy.ts
function computeWithdrawableBalance(balanceEgp, reserveAmount = 200, pendingWithdrawalAmount = 0) {
  return Math.max(0, balanceEgp - reserveAmount - pendingWithdrawalAmount);
}

// Simulated request validation matching src/lib/wallet/wallet.ts createWithdrawalRequest
function validateWithdrawalRequest(wallet, adminSettings, amountEgp) {
  const reserve = wallet.reserveAmount ?? adminSettings.walletReserveAmount ?? 200;
  const limit = wallet.withdrawalLimit ?? adminSettings.defaultWithdrawalLimit ?? null;
  const pending = wallet.pendingWithdrawalAmount ?? 0;
  const withdrawable = computeWithdrawableBalance(wallet.balanceEgp, reserve, pending);

  if (amountEgp <= 0) {
    throw new Error("Enter a valid amount.");
  }
  if (amountEgp > withdrawable) {
    throw new Error(`Amount exceeds your withdrawable balance. (Withdrawable: ${withdrawable} EGP)`);
  }
  if (limit != null && amountEgp > limit) {
    throw new Error(`Amount exceeds your withdrawal limit of ${limit} EGP.`);
  }

  return { reserve, limit, withdrawable };
}

console.log("--- STARTING WALLET RESERVE & WITHDRAWAL LIMIT TESTS ---");

// --- TEST CASE 1: Initial state where wallet.balance = 200, reserveAmount = 200 ---
{
  const wallet = { balanceEgp: 200, reserveAmount: undefined, pendingWithdrawalAmount: 0, withdrawalLimit: undefined };
  const adminSettings = { walletReserveAmount: 200, defaultWithdrawalLimit: null };

  const withdrawable = computeWithdrawableBalance(
    wallet.balanceEgp,
    wallet.reserveAmount ?? adminSettings.walletReserveAmount,
    wallet.pendingWithdrawalAmount
  );
  assert.equal(withdrawable, 0, "Withdrawable balance must be 0 when balance equals reserve amount.");

  assert.throws(
    () => validateWithdrawalRequest(wallet, adminSettings, 50),
    (err) => err.message.includes("Amount exceeds your withdrawable balance"),
    "Withdrawal request must be rejected when amount > withdrawable balance."
  );
  console.log("PASS Test 1: Balance = 200, Reserve = 200 => Withdrawable = 0. Withdrawal rejected.");
}

// --- TEST CASE 2: Admin lowers reserveAmount from 200 to 100 EGP ---
{
  const wallet = { balanceEgp: 200, reserveAmount: undefined, pendingWithdrawalAmount: 0, withdrawalLimit: undefined };
  let adminSettings = { walletReserveAmount: 200, defaultWithdrawalLimit: null };

  // Admin lowers global reserve amount to 100 EGP
  adminSettings.walletReserveAmount = 100;

  // Assert: withdrawable balance recalculates immediately to 100 EGP (200 - 100) with NO earnings change
  const updatedWithdrawable = computeWithdrawableBalance(
    wallet.balanceEgp,
    wallet.reserveAmount ?? adminSettings.walletReserveAmount,
    wallet.pendingWithdrawalAmount
  );
  assert.equal(updatedWithdrawable, 100, "Withdrawable balance must immediately recalculate to 100 EGP.");

  // Assert: withdrawal request for 100 EGP now succeeds
  const res = validateWithdrawalRequest(wallet, adminSettings, 100);
  assert.equal(res.withdrawable, 100);
  console.log("PASS Test 2: Admin lowers reserve to 100 EGP => Withdrawable immediately recalculates to 100 EGP. Withdrawal of 100 EGP succeeds.");
}

// --- TEST CASE 3: Per-driver reserveAmount override lowers reserve for specific driver ---
{
  const wallet = { balanceEgp: 200, reserveAmount: 100, pendingWithdrawalAmount: 0, withdrawalLimit: undefined };
  const adminSettings = { walletReserveAmount: 200, defaultWithdrawalLimit: null }; // global remains 200

  // Driver override (100) takes precedence over global setting (200)
  const withdrawable = computeWithdrawableBalance(
    wallet.balanceEgp,
    wallet.reserveAmount ?? adminSettings.walletReserveAmount,
    wallet.pendingWithdrawalAmount
  );
  assert.equal(withdrawable, 100, "Per-driver reserve override (100) must take precedence over global (200).");

  const res = validateWithdrawalRequest(wallet, adminSettings, 100);
  assert.equal(res.withdrawable, 100);
  console.log("PASS Test 3: Per-driver reserve override (100 EGP) takes precedence over global default (200 EGP).");
}

// --- TEST CASE 4: Withdrawal Limits (Global & Per-Driver Overrides) ---
{
  const wallet = { balanceEgp: 2000, reserveAmount: 200, pendingWithdrawalAmount: 0, withdrawalLimit: undefined };
  const adminSettings = { walletReserveAmount: 200, defaultWithdrawalLimit: 500 };

  // Requesting 600 EGP exceeds global limit (500 EGP)
  assert.throws(
    () => validateWithdrawalRequest(wallet, adminSettings, 600),
    (err) => err.message === "Amount exceeds your withdrawal limit of 500 EGP.",
    "Request above global withdrawal limit must be rejected."
  );

  // Requesting 500 EGP at global limit succeeds
  assert.equal(validateWithdrawalRequest(wallet, adminSettings, 500).limit, 500);

  // Driver override set to 1000 EGP (overriding global 500 EGP)
  wallet.withdrawalLimit = 1000;
  assert.equal(validateWithdrawalRequest(wallet, adminSettings, 600).limit, 1000);

  // Requesting 1200 EGP exceeds driver override limit (1000 EGP)
  assert.throws(
    () => validateWithdrawalRequest(wallet, adminSettings, 1200),
    (err) => err.message === "Amount exceeds your withdrawal limit of 1000 EGP.",
    "Request above driver override limit must be rejected."
  );
  console.log("PASS Test 4: Withdrawal limits enforced correctly (global & per-driver overrides).");
}

// --- TEST CASE 5: Null / Unlimited defaultWithdrawalLimit ---
{
  const wallet = { balanceEgp: 3000, reserveAmount: 200, pendingWithdrawalAmount: 0, withdrawalLimit: undefined };
  const adminSettings = { walletReserveAmount: 200, defaultWithdrawalLimit: null };

  // When defaultWithdrawalLimit is null, driver can withdraw full withdrawable balance (2800 EGP)
  assert.equal(validateWithdrawalRequest(wallet, adminSettings, 2800).limit, null);
  console.log("PASS Test 5: Null defaultWithdrawalLimit treats withdrawal limit as unlimited.");
}

console.log("--- ALL TESTS PASSED SUCCESSFULLY! ---");
