import test from "node:test";
import assert from "node:assert/strict";

const { getRejectionDisplay } = await import("../src/lib/statusDisplay.ts");

test("rejected request returns its stored reason", () => {
  assert.deepEqual(
    getRejectionDisplay({
      request: { status: "rejected", rejectionReason: "No seats available" },
      trip: { status: "cancelled", cancelledBy: "admin_rejected" },
    }),
    { showReasonCard: true, reason: "No seats available", fallback: false },
  );
});

test("rejected request with an empty reason returns the fallback state", () => {
  assert.deepEqual(
    getRejectionDisplay({
      request: { status: "rejected", rejectionReason: "  " },
      trip: { status: "cancelled", cancelledBy: "admin_rejected", cancelReason: "Rejected by admin" },
    }),
    { showReasonCard: true, reason: null, fallback: true },
  );
});

test("old rejected documents do not require cancelledBy", () => {
  assert.deepEqual(
    getRejectionDisplay({
      request: { status: "rejected", rejectionReason: "Outside service area" },
      trip: { status: "cancelled" },
    }),
    { showReasonCard: true, reason: "Outside service area", fallback: false },
  );
});

test("non-rejected trip does not show a rejection card", () => {
  assert.deepEqual(
    getRejectionDisplay({
      request: { status: "submitted", rejectionReason: "Old note" },
      trip: { status: "active" },
    }),
    { showReasonCard: false, reason: null, fallback: false },
  );
});