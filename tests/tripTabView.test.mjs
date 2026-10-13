import test from "node:test";
import assert from "node:assert/strict";

const { buildTripTabView } = await import("../src/lib/tripTabView.ts");
const now = new Date("2026-10-03T09:00:00.000Z");

test("multi-day unpaid Requests appear only in Bookings", () => {
  const rows = [
    { id: "p1", requestId: "pending-1", isStandalone: false, status: "pending_payment", parentRequestStatus: "approved", parentPaymentStatus: "pending", canPay: true, date: "2026-10-04", pickupTime: "09:00" },
    { id: "p2", requestId: "pending-1", isStandalone: false, status: "pending_payment", parentRequestStatus: "approved", parentPaymentStatus: "pending", canPay: true, date: "2026-10-05", pickupTime: "09:00" },
    { id: "u1", requestId: "paid-1", isStandalone: false, status: "submitted", parentRequestStatus: "submitted", date: "2026-10-06", pickupTime: "09:00" },
    { id: "o1", requestId: "paid-2", isStandalone: false, status: "active", parentRequestStatus: "active", date: "2026-10-07", pickupTime: "09:00" },
    { id: "h1", requestId: "old-1", isStandalone: false, status: "completed", parentRequestStatus: "submitted", date: "2026-10-01", pickupTime: "09:00" },
  ];
  const view = buildTripTabView(rows, "all", now);
  assert.deepEqual(view.counts, { all: 2, pending: 0, upcoming: 1, ongoing: 1, bookings: 1 });
  assert.deepEqual(
    view.items.map((item) => item.kind),
    ["trip", "trip"],
  );
  assert.equal(view.items.some((item) => item.kind === "trip" && item.trip.id === "h1"), false);
  const bookings = buildTripTabView(rows, "bookings", now);
  assert.equal(bookings.counts.bookings, 1);
  assert.equal(bookings.readyToPayCount, 1);
  assert.equal(bookings.items.length, 1);
  assert.equal(bookings.items[0].kind, "request");
  assert.deepEqual(bookings.items[0].trips.map((trip) => trip.id), ["p1", "p2"]);
});

test("pending tab excludes multi-day unpaid Requests", () => {
  const rows = [
    { id: "a", requestId: "request", isStandalone: false, status: "pending_payment", parentRequestStatus: "waiting_list", date: "2026-10-04", pickupTime: "09:00" },
    { id: "b", requestId: "request", isStandalone: false, status: "pending_payment", parentRequestStatus: "waiting_list", date: "2026-10-05", pickupTime: "09:00" },
  ];
  const view = buildTripTabView(rows, "pending", now);
  assert.equal(view.counts.pending, 0);
  assert.equal(view.items.length, 0);
  const bookings = buildTripTabView(rows, "bookings", now);
  assert.equal(bookings.counts.bookings, 1);
  assert.equal(bookings.items[0].kind, "request");
  assert.equal(bookings.items[0].trips.length, 2);
});

test("paid Request children remain normal trips and are never Bookings", () => {
  const rows = [
    { id: "paid-1", requestId: "paid-request", isStandalone: false, status: "submitted", parentRequestStatus: "submitted", parentPaymentStatus: "paid", date: "2026-10-04", pickupTime: "09:00" },
    { id: "paid-2", requestId: "paid-request", isStandalone: false, status: "submitted", parentRequestStatus: "submitted", parentPaymentStatus: "paid", date: "2026-10-05", pickupTime: "09:00" },
  ];
  const all = buildTripTabView(rows, "all", now);
  assert.equal(all.counts.bookings, 0);
  assert.deepEqual(all.items.map((item) => item.kind), ["trip", "trip"]);
  assert.deepEqual(all.items.map((item) => item.trip.id), ["paid-1", "paid-2"]);
  assert.equal(buildTripTabView(rows, "bookings", now).items.length, 0);
});

test("waiting multi-day Requests are Bookings without being ready to pay", () => {
  const rows = [
    { id: "w1", requestId: "waiting", isStandalone: false, status: "pending_payment", parentRequestStatus: "waiting_list", parentPaymentStatus: "pending", canPay: false, date: "2026-10-04", pickupTime: "09:00" },
    { id: "w2", requestId: "waiting", isStandalone: false, status: "pending_payment", parentRequestStatus: "waiting_list", parentPaymentStatus: "pending", canPay: false, date: "2026-10-05", pickupTime: "09:00" },
  ];
  const view = buildTripTabView(rows, "bookings", now);
  assert.equal(view.counts.bookings, 1);
  assert.equal(view.readyToPayCount, 0);
  assert.equal(view.items.length, 1);
});

test("standalone pending Trips stay as individual rows and retain one pay action per trip", () => {
  const rows = [
    { id: "wait", requestId: "wait", isStandalone: true, status: "waiting_list", paymentStatus: "pending", date: "2026-10-04", pickupTime: "09:00" },
    { id: "approved", requestId: "approved", isStandalone: true, status: "approved", paymentStatus: "failed", date: "2026-10-05", pickupTime: "09:00" },
    { id: "pending", requestId: "pending", isStandalone: true, status: "pending_payment", paymentStatus: "pending", date: "2026-10-06", pickupTime: "09:00" },
  ];
  const view = buildTripTabView(rows, "pending", now);
  assert.equal(view.counts.pending, 3);
  assert.deepEqual(view.items.map((item) => item.kind), ["trip", "trip", "trip"]);
  assert.deepEqual(view.items.map((item) => item.trip.id), ["wait", "approved", "pending"]);
});