import assert from "node:assert/strict";
import { test } from "node:test";
import { Types } from "mongoose";

const {
  applyEarningWithDebt,
  buildEarningWalletUpdate,
  buildPenaltyWalletUpdate,
  computePenaltyApplication,
  computeWithdrawable,
} = await import("../src/lib/walletPenalty.ts");

test("penalty deducts from a larger balance or consumes an exact balance", () => {
  assert.deepEqual(
    computePenaltyApplication({
      balanceEgp: 100,
      owedEgp: 0,
      penaltyEgp: 40,
    }),
    {
      deductedEgp: 40,
      newBalanceEgp: 60,
      addedDebtEgp: 0,
      newOwedEgp: 0,
    },
  );
  assert.deepEqual(
    computePenaltyApplication({
      balanceEgp: 40,
      owedEgp: 0,
      penaltyEgp: 40,
    }),
    {
      deductedEgp: 40,
      newBalanceEgp: 0,
      addedDebtEgp: 0,
      newOwedEgp: 0,
    },
  );
});

test("penalty records shortage as debt without making balance negative", () => {
  assert.deepEqual(
    computePenaltyApplication({
      balanceEgp: 25,
      owedEgp: 10,
      penaltyEgp: 40,
    }),
    {
      deductedEgp: 25,
      newBalanceEgp: 0,
      addedDebtEgp: 15,
      newOwedEgp: 25,
    },
  );
  assert.deepEqual(
    computePenaltyApplication({
      balanceEgp: 0,
      owedEgp: 0,
      penaltyEgp: 20,
    }),
    {
      deductedEgp: 0,
      newBalanceEgp: 0,
      addedDebtEgp: 20,
      newOwedEgp: 20,
    },
  );
});

test("zero penalty and decimal amounts preserve non-negative EGP precision", () => {
  assert.deepEqual(
    computePenaltyApplication({
      balanceEgp: 0,
      owedEgp: 0,
      penaltyEgp: 0,
    }),
    {
      deductedEgp: 0,
      newBalanceEgp: 0,
      addedDebtEgp: 0,
      newOwedEgp: 0,
    },
  );
  assert.deepEqual(
    computePenaltyApplication({
      balanceEgp: 10.25,
      owedEgp: 1.1,
      penaltyEgp: 10.5,
    }),
    {
      deductedEgp: 10.25,
      newBalanceEgp: 0,
      addedDebtEgp: 0.25,
      newOwedEgp: 1.35,
    },
  );
});

test("earnings repay debt before increasing balance", () => {
  assert.deepEqual(
    applyEarningWithDebt({
      balanceEgp: 10,
      owedEgp: 30,
      earningEgp: 20,
    }),
    { repaidEgp: 20, newBalanceEgp: 10, newOwedEgp: 10 },
  );
  assert.deepEqual(
    applyEarningWithDebt({
      balanceEgp: 10,
      owedEgp: 10,
      earningEgp: 25,
    }),
    { repaidEgp: 10, newBalanceEgp: 25, newOwedEgp: 0 },
  );
  assert.deepEqual(
    applyEarningWithDebt({
      balanceEgp: 10,
      owedEgp: 0,
      earningEgp: 2.35,
    }),
    { repaidEgp: 0, newBalanceEgp: 12.35, newOwedEgp: 0 },
  );
});

test("debt blocks withdrawal; otherwise the reserve is respected", () => {
  assert.equal(
    computeWithdrawable({ balanceEgp: 1000, owedEgp: 1, reserveEgp: 200 }),
    0,
  );
  assert.equal(
    computeWithdrawable({ balanceEgp: 150, owedEgp: 0, reserveEgp: 200 }),
    0,
  );
  assert.equal(
    computeWithdrawable({ balanceEgp: 500, owedEgp: 0, reserveEgp: 200 }),
    300,
  );
});

test("money rules reject negative, non-finite, or unsafe amounts", () => {
  for (const invalid of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.throws(
      () =>
        computePenaltyApplication({
          balanceEgp: invalid,
          owedEgp: 0,
          penaltyEgp: 0,
        }),
      RangeError,
    );
  }
});

test("a cancellation penalty applies for low or missing wallets", () => {
  assert.deepEqual(
    computePenaltyApplication({
      balanceEgp: 5,
      owedEgp: 0,
      penaltyEgp: 20,
    }),
    {
      deductedEgp: 5,
      newBalanceEgp: 0,
      addedDebtEgp: 15,
      newOwedEgp: 15,
    },
  );
  assert.deepEqual(
    computePenaltyApplication({
      balanceEgp: 0,
      owedEgp: 0,
      penaltyEgp: 20,
    }),
    {
      deductedEgp: 0,
      newBalanceEgp: 0,
      addedDebtEgp: 20,
      newOwedEgp: 20,
    },
  );
});

test("penalty update is one upsertable pipeline with an atomic balance floor", () => {
  const pipeline = buildPenaltyWalletUpdate(
    new Types.ObjectId("507f1f77bcf86cd799439011"),
    30,
    new Date("2026-10-17T00:00:00.000Z"),
  );
  const set = pipeline[0].$set;

  assert.equal(pipeline.length, 1);
  assert.deepEqual(set.balanceEgp, {
    $max: [
      0,
      {
        $subtract: [
          { $ifNull: ["$balanceEgp", 0] },
          30,
        ],
      },
    ],
  });

  test("earning update applies debt before increasing balance atomically", () => {
    const pipeline = buildEarningWalletUpdate(
      new Types.ObjectId("507f1f77bcf86cd799439011"),
      25,
      new Date("2026-10-17T00:00:00.000Z"),
    );
    const set = pipeline[0].$set;

    assert.deepEqual(set.balanceEgp, {
      $add: [
        { $ifNull: ["$balanceEgp", 0] },
        {
          $subtract: [
            25,
            { $min: [{ $ifNull: ["$owedEgp", 0] }, 25] },
          ],
        },
      ],
    });
    assert.deepEqual(set.owedEgp, {
      $max: [
        0,
        { $subtract: [{ $ifNull: ["$owedEgp", 0] }, 25] },
      ],
    });
  });
  assert.deepEqual(set.owedEgp, {
    $add: [
      { $ifNull: ["$owedEgp", 0] },
      {
        $max: [
          0,
          {
            $subtract: [
              30,
              { $ifNull: ["$balanceEgp", 0] },
            ],
          },
        ],
      },
    ],
  });
});
