import test from "node:test";
import assert from "node:assert/strict";

const { runRequestSettlementWith } = await import(
  "../src/lib/payments/requestSettlementFlow.ts"
);

function makeStore({ captureWallet } = {}) {
  const state = {
    requestPaid: false,
    childUpdates: 0,
    captures: 0,
    paymentFinalizations: 0,
    webhookEvents: new Set(),
  };

  return {
    state,
    async withTransaction(work) {
      const before = structuredClone(state);
      try {
        await work();
      } catch (error) {
        Object.assign(state, before);
        throw error;
      }
    },
    async isAlreadySettled() {
      return state.requestPaid;
    },
    async claimRequest() {
      if (state.requestPaid) return false;
      state.requestPaid = true;
      return true;
    },
    async updateChildren() {
      state.childUpdates += 1;
    },
    async captureWallet() {
      state.captures += 1;
      return captureWallet ? captureWallet() : 100;
    },
    async finalizePayment() {
      state.paymentFinalizations += 1;
    },
    async recordWebhookEvent(transactionId) {
      state.webhookEvents.add(transactionId);
    },
  };
}

test("capture returning null rolls back Request, children, Payment, and webhook event", async () => {
  const store = makeStore({ captureWallet: async () => null });

  const result = await runRequestSettlementWith(store, "txn-1");

  assert.equal(result, "capture_failed");
  assert.equal(store.state.requestPaid, false);
  assert.equal(store.state.childUpdates, 0);
  assert.equal(store.state.paymentFinalizations, 0);
  assert.equal(store.state.webhookEvents.has("txn-1"), false);
});

test("capture throwing rolls back Request and remains retryable", async () => {
  const store = makeStore({
    captureWallet: async () => {
      throw new Error("wallet capture failed");
    },
  });

  await assert.rejects(runRequestSettlementWith(store, "txn-1"), /capture failed/);
  assert.equal(store.state.requestPaid, false);
  assert.equal(store.state.childUpdates, 0);
  assert.equal(store.state.paymentFinalizations, 0);
  assert.equal(store.state.webhookEvents.has("txn-1"), false);
});

test("the same webhook transaction can retry after capture failure", async () => {
  let failCapture = true;
  const store = makeStore({
    captureWallet: async () => {
      if (failCapture) return null;
      return 100;
    },
  });

  assert.equal(await runRequestSettlementWith(store, "txn-1"), "capture_failed");
  failCapture = false;
  assert.equal(await runRequestSettlementWith(store, "txn-1"), "settled");
  assert.equal(store.state.requestPaid, true);
  assert.equal(store.state.webhookEvents.has("txn-1"), true);
});

test("verify and webhook settlement modes use the same retryable transaction steps", async () => {
  for (const source of ["webhook", "wallet_verify", "kashier_verify"]) {
    const store = makeStore({
      captureWallet: async () => (source === "webhook" ? null : 100),
    });

    const result = await runRequestSettlementWith(store, "txn-1");

    assert.equal(result, source === "webhook" ? "capture_failed" : "settled");
    assert.equal(store.state.requestPaid, source !== "webhook");
    assert.equal(store.state.paymentFinalizations, source === "webhook" ? 0 : 1);
  }
});

test("duplicate settlement after success does not capture or update children twice", async () => {
  const store = makeStore();

  assert.equal(await runRequestSettlementWith(store, "txn-1"), "settled");
  assert.equal(await runRequestSettlementWith(store, "txn-1"), "already_settled");
  assert.equal(store.state.captures, 1);
  assert.equal(store.state.childUpdates, 1);
  assert.equal(store.state.paymentFinalizations, 1);
});
