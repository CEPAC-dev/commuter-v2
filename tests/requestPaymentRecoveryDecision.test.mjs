import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { recoverPaidRequestPayment } = await import(
  "../src/lib/payments/requestPaymentRecoveryDecision.ts"
);

function createRecoveryHarness(request, payment, expectedAmountEgp) {
  const state = {
    request: structuredClone(request),
    payment: structuredClone(payment),
    settlementCount: 0,
    issues: new Map(),
  };
  const input = () => ({
    request: state.request,
    payment: state.payment,
    expectedAmountEgp,
  });
  const operations = {
    async settle() {
      state.settlementCount += 1;
      state.request.paymentStatus = "paid";
      state.payment.overallStatus = "paid";
      return "settled";
    },
    async recordIssue(issue) {
      const key = `${issue.manualReview ? "review" : "mismatch"}:${issue.issue}`;
      state.issues.set(key, issue);
    },
  };
  return { state, input, operations };
}

test("late closed card Payment settles a still-payable Request once", async () => {
  const harness = createRecoveryHarness(
    { status: "pending_payment", paymentStatus: "failed" },
    {
      overallStatus: "failed",
      totalEgp: 280,
      walletAmountEgp: 0,
      walletStatus: "none",
    },
    280,
  );

  assert.equal(
    await recoverPaidRequestPayment(harness.input(), harness.operations),
    "settled",
  );
  assert.equal(
    await recoverPaidRequestPayment(harness.input(), harness.operations),
    "already_processed",
  );
  assert.equal(harness.state.settlementCount, 1);
  assert.equal(harness.state.issues.size, 0);
});

test("late Payment for a cancelled or expired Request requires manual review", async () => {
  for (const request of [
    { status: "cancelled", paymentStatus: "expired" },
    { status: "time_out", paymentStatus: "expired" },
  ]) {
    const harness = createRecoveryHarness(
      request,
      {
        overallStatus: "cancelled",
        totalEgp: 280,
        walletAmountEgp: 0,
        walletStatus: "none",
      },
      280,
    );
    assert.equal(
      await recoverPaidRequestPayment(harness.input(), harness.operations),
      "manual_review",
    );
    assert.equal(harness.state.settlementCount, 0);
    assert.equal(harness.state.issues.size, 1);
    assert.equal([...harness.state.issues.values()][0].manualReview, true);
  }
});

test("amount mismatch settles an eligible Request and replay adds no duplicate alert", async () => {
  const harness = createRecoveryHarness(
    { status: "pending_payment", paymentStatus: "pending" },
    {
      overallStatus: "kashier_pending",
      totalEgp: 300,
      walletAmountEgp: 0,
      walletStatus: "none",
    },
    280,
  );

  assert.equal(
    await recoverPaidRequestPayment(harness.input(), harness.operations),
    "settled_with_mismatch",
  );
  assert.equal(
    await recoverPaidRequestPayment(harness.input(), harness.operations),
    "already_processed",
  );
  assert.equal(harness.state.settlementCount, 1);
  assert.equal(harness.state.issues.size, 1);
  assert.deepEqual([...harness.state.issues.values()][0], {
    issue: "amount_mismatch",
    paidAmountEgp: 300,
    expectedAmountEgp: 280,
    manualReview: false,
  });
});

test("closed late Payment with an amount mismatch requires manual review", async () => {
  const harness = createRecoveryHarness(
    { status: "pending_payment", paymentStatus: "failed" },
    {
      overallStatus: "failed",
      totalEgp: 300,
      walletAmountEgp: 0,
      walletStatus: "none",
    },
    280,
  );
  assert.equal(
    await recoverPaidRequestPayment(harness.input(), harness.operations),
    "manual_review",
  );
  assert.equal(harness.state.settlementCount, 0);
  assert.equal(harness.state.issues.size, 1);
  assert.equal(
    [...harness.state.issues.values()][0].issue,
    "late_payment_amount_mismatch",
  );
});

test("late closed Payment amount is rechecked when settlement loses a race", async () => {
  const harness = createRecoveryHarness(
    { status: "pending_payment", paymentStatus: "failed" },
    {
      overallStatus: "failed",
      totalEgp: 280,
      walletAmountEgp: 0,
      walletStatus: "none",
    },
    280,
  );
  const result = await recoverPaidRequestPayment(harness.input(), {
    async settle() {
      return "not_settled";
    },
    async getExpectedAmountEgp() {
      return 200;
    },
    async recordIssue(issue) {
      harness.state.issues.set(issue.issue, issue);
    },
  });

  assert.equal(result, "manual_review");
  assert.equal(harness.state.settlementCount, 0);
  assert.deepEqual(harness.state.issues.get("late_payment_amount_mismatch"), {
    issue: "late_payment_amount_mismatch",
    paidAmountEgp: 280,
    expectedAmountEgp: 200,
    manualReview: true,
  });
});

test("released wallet reservation prevents late auto-settlement", async () => {
  const harness = createRecoveryHarness(
    { status: "pending_payment", paymentStatus: "failed" },
    {
      overallStatus: "failed",
      totalEgp: 300,
      walletAmountEgp: 100,
      walletStatus: "released",
    },
    300,
  );
  assert.equal(
    await recoverPaidRequestPayment(harness.input(), harness.operations),
    "manual_review",
  );
  assert.equal(harness.state.settlementCount, 0);
  assert.equal(
    [...harness.state.issues.values()][0].issue,
    "wallet_reservation_released",
  );
});

test("webhook and callback route Request successes through recoverable settlement", async () => {
  const [webhook, kashier, settlement, recovery, adminActivity, adminRoute] =
    await Promise.all([
      readFile(
        new URL("../src/app/api/payments/webhook/route.ts", import.meta.url),
        "utf8",
      ),
      readFile(new URL("../src/lib/payments/kashier.ts", import.meta.url), "utf8"),
      readFile(
        new URL("../src/lib/payments/requestSettlement.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../src/lib/payments/requestPaymentRecovery.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../src/lib/notifications/adminActivity.ts", import.meta.url),
        "utf8",
      ),
      readFile(
        new URL("../src/app/api/admin/transactions/[id]/route.ts", import.meta.url),
        "utf8",
      ),
    ]);

  assert.match(webhook, /handlePaidRequestPayment\(\s*\{\s*paymentId:[\s\S]*?transactionId/);
  assert.match(kashier, /handlePaidRequestPayment\(\s*\{\s*paymentId:[\s\S]*?\}\)/);
  assert.match(recovery, /allowClosedPayment:\s*true/);
  assert.match(recovery, /requireAmountMatch:\s*!ACTIVE_PAYMENT_STATUSES\.has/);
  assert.match(recovery, /status:\s*\{\s*\$ne:\s*"cancelled"\s*\}/);
  assert.match(recovery, /request_payment_manual_review/);
  assert.match(recovery, /request_payment_amount_mismatch/);
  assert.match(settlement, /\[\.\.\.ACTIVE_PAYMENT_STATUSES,\s*"failed",\s*"cancelled"\]/);
  assert.match(settlement, /"cancelled",\s*"time_out"/);
  assert.match(adminActivity, /dedupeKey:\s*latePaymentDedupeKey\(input\.paymentId\)/);
  assert.match(adminActivity, /paidAmountEgp:\s*input\.paidAmountEgp/);
  assert.match(adminActivity, /expectedAmountEgp:\s*input\.expectedAmountEgp/);
  assert.match(adminActivity, /reason:\s*input\.reason/);
  assert.match(adminRoute, /"request_payment_manual_review"/);
  assert.match(adminRoute, /"request_payment_amount_mismatch"/);
});
