import test from "node:test";
import assert from "node:assert/strict";

const { groupTripsByRequest } = await import(
  "../src/lib/groupRequestTrips.ts"
);

test("keeps legacy Request groups intact and standalone Trips ungrouped", () => {
  const grouped = groupTripsByRequest([
    { id: "trip-2", requestId: "request-a", isStandalone: false, date: "2026-10-04", status: "pending_payment" },
    { id: "trip-single", requestId: "request-b", isStandalone: false, date: "2026-10-03", status: "submitted" },
    { id: "trip-1", requestId: "request-a", isStandalone: false, date: "2026-10-03", status: "pending_payment" },
    { id: "trip-3", requestId: "request-a", isStandalone: false, date: "2026-10-05", status: "pending_payment" },
    { id: "standalone", requestId: "standalone", isStandalone: true, date: "2026-10-02", status: "pending_payment" },
  ]);

  assert.equal(grouped.length, 3);
  assert.deepEqual(grouped[0], {
    kind: "group",
    requestId: "request-a",
    trips: [
      { id: "trip-1", requestId: "request-a", isStandalone: false, date: "2026-10-03", status: "pending_payment" },
      { id: "trip-2", requestId: "request-a", isStandalone: false, date: "2026-10-04", status: "pending_payment" },
      { id: "trip-3", requestId: "request-a", isStandalone: false, date: "2026-10-05", status: "pending_payment" },
    ],
  });
  assert.deepEqual(grouped[1], {
    kind: "group",
    requestId: "request-b",
    trips: [{ id: "trip-single", requestId: "request-b", isStandalone: false, date: "2026-10-03", status: "submitted" }],
  });
  assert.deepEqual(grouped[2], {
    kind: "single",
    trip: { id: "standalone", requestId: "standalone", isStandalone: true, date: "2026-10-02", status: "pending_payment" },
  });
});