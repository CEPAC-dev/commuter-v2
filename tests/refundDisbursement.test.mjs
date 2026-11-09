import test from "node:test";
import assert from "node:assert/strict";
import { planRefundSplit } from "../src/lib/payments/refundMath.ts";
import { buildRequestSummaryUpdate } from "../src/lib/payments/requestSummary.ts";

test("refunds captured wallet funds first, then the remaining gateway amount", () => {
    assert.deepEqual(planRefundSplit(800, 500, 100), {
        walletRefundEgp: 400,
        gatewayRefundEgp: 400,
    });
    assert.deepEqual(planRefundSplit(200, 500, 400), {
        walletRefundEgp: 100,
        gatewayRefundEgp: 100,
    });
});

test("reconciles Request payment and lifecycle summaries from child/payment states", () => {
    assert.deepEqual(
        buildRequestSummaryUpdate({
            tripStatuses: ["cancelled", "submitted"],
            paymentOverallStatus: "partially_refunded",
        }),
        { paymentStatus: "partially_refunded" },
    );
    assert.deepEqual(
        buildRequestSummaryUpdate({
            tripStatuses: ["cancelled", "refunded"],
            paymentOverallStatus: "refunded",
        }),
        { status: "cancelled", paymentStatus: "refunded" },
    );
});