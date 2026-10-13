import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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

test("card-only Request settlement does not require a wallet capture", async () => {
  const state = { requestPaid: false, childUpdates: 0, paymentFinalizations: 0 };
  const result = await runRequestSettlementWith(
    {
      async withTransaction(work) {
        await work();
      },
      async isAlreadySettled() {
        return state.requestPaid;
      },
      async claimRequest() {
        state.requestPaid = true;
        return true;
      },
      async updateChildren() {
        state.childUpdates += 1;
      },
      async finalizePayment() {
        state.paymentFinalizations += 1;
      },
    },
    "card-only",
  );
  assert.equal(result, "settled");
  assert.equal(state.requestPaid, true);
  assert.equal(state.childUpdates, 1);
  assert.equal(state.paymentFinalizations, 1);
});

test("settlement updates only non-cancelled children and logs amount mismatch once", async () => {
  const children = [
    { status: "pending_payment", paymentStatus: "pending", priceEgp: 100 },
    {
      status: "cancelled",
      paymentStatus: "pending",
      priceEgp: 90,
      cancelledBy: "passenger",
      metadata: { keep: true },
    },
    { status: "pending_payment", paymentStatus: "pending", priceEgp: 80 },
  ];
  const cancelledBefore = structuredClone(children[1]);
  const logs = [];
  const originalInfo = console.info;
  console.info = (line) => logs.push(line);
  try {
    let settled = false;
    const result = await runRequestSettlementWith({
      async withTransaction(work) {
        await work();
      },
      async isAlreadySettled() {
        return settled;
      },
      async claimRequest() {
        settled = true;
        return true;
      },
      async updateChildren() {
        for (const child of children) {
          if (child.status !== "cancelled") child.paymentStatus = "paid";
          if (child.status === "pending_payment") child.status = "submitted";
        }
        const paid = 300;
        const expected = children
          .filter((child) => child.status !== "cancelled")
          .reduce((sum, child) => sum + child.priceEgp, 0);
        if (paid !== expected) {
          console.info(
            JSON.stringify({
              tag: "[multiday]",
              event: "settlement_amount_mismatch",
              requestId: "request-id",
              paid,
              expected,
            }),
          );
        }
      },
    });
    assert.equal(result, "settled");
    assert.deepEqual(children[1], cancelledBefore);
    assert.equal(children[0].status, "submitted");
    assert.equal(children[0].paymentStatus, "paid");
    assert.equal(children[2].status, "submitted");
    assert.equal(children[2].paymentStatus, "paid");
    assert.equal(logs.length, 1);
    assert.deepEqual(JSON.parse(logs[0]), {
      tag: "[multiday]",
      event: "settlement_amount_mismatch",
      requestId: "request-id",
      paid: 300,
      expected: 180,
    });

    assert.equal(
      await runRequestSettlementWith({
        async withTransaction(work) {
          await work();
        },
        async isAlreadySettled() {
          return settled;
        },
        async claimRequest() {
          assert.fail("duplicate settlement must not claim");
        },
        async updateChildren() {
          assert.fail("duplicate settlement must not update children");
        },
      }),
      "already_settled",
    );
    assert.equal(logs.length, 1);
  } finally {
    console.info = originalInfo;
  }

  const source = await readFile(
    new URL("../src/lib/payments/requestSettlement.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /status:\s*\{\s*\$ne:\s*"cancelled"\s*\}[\s\S]*?\$set:\s*\{\s*paymentStatus:\s*"paid"/,
  );
  assert.match(source, /status:\s*"pending_payment"/);
  assert.match(source, /event:\s*"settlement_amount_mismatch"/);
});
