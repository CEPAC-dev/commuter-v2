import test from "node:test";
import assert from "node:assert/strict";

const { buildTripTabView } = await import("../src/lib/tripTabView.ts");
const now = new Date("2026-10-03T09:00:00.000Z");

test("All keeps pending trip rows individual while Pending groups a Request once", () => {
  const rows = [
    { id: "p1", requestId: "pending-1", status: "pending_payment", parentRequestStatus: "approved", date: "2026-10-04", pickupTime: "09:00" },
    { id: "p2", requestId: "pending-1", status: "pending_payment", parentRequestStatus: "approved", date: "2026-10-05", pickupTime: "09:00" },
    { id: "u1", requestId: "paid-1", status: "submitted", parentRequestStatus: "submitted", date: "2026-10-06", pickupTime: "09:00" },
    { id: "o1", requestId: "paid-2", status: "active", parentRequestStatus: "active", date: "2026-10-07", pickupTime: "09:00" },
    { id: "h1", requestId: "old-1", status: "completed", parentRequestStatus: "submitted", date: "2026-10-01", pickupTime: "09:00" },
  ];
  const view = buildTripTabView(rows, "all", now);
  assert.deepEqual(view.counts, { all: 4, pending: 1, upcoming: 1, ongoing: 1 });
  assert.deepEqual(
    view.items.map((item) => item.kind),
    ["trip", "trip", "trip", "trip"],
  );
  assert.equal(view.items.some((item) => item.kind === "trip" && item.trip.id === "h1"), false);
});

test("pending tab contains only grouped unpaid Requests", () => {
  const rows = [
    { id: "a", requestId: "request", status: "pending_payment", parentRequestStatus: "waiting_list", date: "2026-10-04", pickupTime: "09:00" },
    { id: "b", requestId: "request", status: "pending_payment", parentRequestStatus: "waiting_list", date: "2026-10-05", pickupTime: "09:00" },
  ];
  const view = buildTripTabView(rows, "pending", now);
  assert.equal(view.counts.pending, 1);
  assert.equal(view.items.length, 1);
  assert.equal(view.items[0].kind, "request");
  assert.equal(view.items[0].trips.length, 2);
});