import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const {
  buildAdminWalletAdjustmentUpdate,
  computeWalletAdjustment,
  isAdminWalletAdjustmentAuthorized,
} = await import("../src/lib/walletPenalty.ts");

test("wallet adjustment authorization accepts only admin roles", () => {
  assert.equal(isAdminWalletAdjustmentAuthorized("admin"), true);
  assert.equal(isAdminWalletAdjustmentAuthorized("driver"), false);
  assert.equal(isAdminWalletAdjustmentAuthorized("passenger"), false);
  assert.equal(isAdminWalletAdjustmentAuthorized(null), false);
});

test("debt waiver is capped at the outstanding amount", () => {
  assert.deepEqual(
    computeWalletAdjustment({
      type: "waive_debt",
      balanceEgp: 50,
      owedEgp: 20,
      amountEgp: 30,
    }),
    {
      appliedAmountEgp: 20,
      debtReductionEgp: 20,
      balanceCreditEgp: 0,
      newBalanceEgp: 50,
      newOwedEgp: 0,
    },
  );
  assert.deepEqual(
    computeWalletAdjustment({
      type: "waive_debt",
      balanceEgp: 50,
      owedEgp: 0,
      amountEgp: 30,
    }),
    {
      appliedAmountEgp: 0,
      debtReductionEgp: 0,
      balanceCreditEgp: 0,
      newBalanceEgp: 50,
      newOwedEgp: 0,
    },
  );
});

test("penalty refunds reduce debt before crediting balance", () => {
  assert.deepEqual(
    computeWalletAdjustment({
      type: "refund_penalty",
      balanceEgp: 10,
      owedEgp: 30,
      amountEgp: 20,
    }),
    {
      appliedAmountEgp: 20,
      debtReductionEgp: 20,
      balanceCreditEgp: 0,
      newBalanceEgp: 10,
      newOwedEgp: 10,
    },
  );
  assert.deepEqual(
    computeWalletAdjustment({
      type: "refund_penalty",
      balanceEgp: 10,
      owedEgp: 5,
      amountEgp: 20,
    }),
    {
      appliedAmountEgp: 20,
      debtReductionEgp: 5,
      balanceCreditEgp: 15,
      newBalanceEgp: 25,
      newOwedEgp: 0,
    },
  );
});

test("adjustments reject invalid amounts and wallet balance overflow", () => {
  assert.throws(
    () =>
      computeWalletAdjustment({
        type: "waive_debt",
        balanceEgp: 0,
        owedEgp: 10,
        amountEgp: -1,
      }),
    RangeError,
  );
  assert.throws(
    () =>
      computeWalletAdjustment({
        type: "refund_penalty",
        balanceEgp: 1_000_000_000,
        owedEgp: 0,
        amountEgp: 1,
      }),
    RangeError,
  );
});

test("admin adjustment update persists totals and initializes missing wallet fields", () => {
  const [stage] = buildAdminWalletAdjustmentUpdate(
    { toString: () => "507f1f77bcf86cd799439011" },
    { newBalanceEgp: 15, newOwedEgp: 0, balanceCreditEgp: 5 },
    new Date("2026-10-17T00:00:00.000Z"),
  );
  assert.equal(stage.$set.balanceEgp, 15);
  assert.equal(stage.$set.owedEgp, 0);
  assert.deepEqual(stage.$set.totalCreditedEgp, {
    $add: [{ $ifNull: ["$totalCreditedEgp", 0] }, 5],
  });
});

test("adjustment route uses admin auth and one database transaction", async () => {
  const route = await readFile(
    new URL(
      "../src/app/api/admin/wallets/[driverId]/adjust/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  assert.match(route, /adminAuth\(\)/);
  assert.match(route, /withTransaction/);
  assert.match(route, /buildAdminWalletAdjustmentUpdate/);
  assert.match(route, /Log\.create/);
});
