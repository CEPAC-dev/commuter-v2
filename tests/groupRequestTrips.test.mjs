import test from "node:test";
import assert from "node:assert/strict";

const { groupTripsByRequest } = await import(
  "../src/lib/groupRequestTrips.ts"
);

test("groups sibling trips by request and leaves single trips ungrouped", () => {
  const grouped = groupTripsByRequest([
    { id: "trip-2", requestId: "request-a", date: "2026-10-04", status: "pending_payment" },
    { id: "trip-single", requestId: "request-b", date: "2026-10-03", status: "submitted" },
    { id: "trip-1", requestId: "request-a", date: "2026-10-03", status: "pending_payment" },
    { id: "trip-3", requestId: "request-a", date: "2026-10-05", status: "pending_payment" },
  ]);

  assert.equal(grouped.length, 2);
  assert.deepEqual(grouped[0], {
    kind: "group",
    requestId: "request-a",
    trips: [
      { id: "trip-1", requestId: "request-a", date: "2026-10-03", status: "pending_payment" },
      { id: "trip-2", requestId: "request-a", date: "2026-10-04", status: "pending_payment" },
      { id: "trip-3", requestId: "request-a", date: "2026-10-05", status: "pending_payment" },
    ],
  });
  assert.deepEqual(grouped[1], {
    kind: "single",
    trip: { id: "trip-single", requestId: "request-b", date: "2026-10-03", status: "submitted" },
  });
});