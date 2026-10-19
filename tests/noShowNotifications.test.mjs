import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { getNoShowTripNotificationPayload } = await import(
  "../src/lib/notifications/noShowTripPayload.ts"
);

test("no-show notification is localized, trip-linked, and contains no free text or phone", () => {
  const payload = getNoShowTripNotificationPayload("trip-id");
  assert.deepEqual(payload, {
    type: "no_show_trip",
    title: "Marked as not present",
    body: "You were marked as not present at pickup. If this is a mistake, you can request a review.",
    titleAr: "تم تسجيل عدم الحضور",
    bodyAr:
      "تم تسجيل عدم حضورك عند نقطة الركوب. إذا كان ذلك بالخطأ، يمكنك طلب المراجعة.",
    data: {
      tripId: "trip-id",
      linkUrl: "/my-trips/trip-id",
    },
  });
  assert.doesNotMatch(JSON.stringify(payload), /phone|driver|note/i);
});

test("end-ride notification failures are isolated from the request", async () => {
  const source = await readFile(
    new URL("../src/lib/notifications/noShowTrip.ts", import.meta.url),
    "utf8",
  );
  const route = await readFile(
    new URL("../src/app/api/actions/ride/[rideId]/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /Promise\.allSettled/);
  assert.match(source, /catch \{/);
  assert.match(source, /no_show/);
  assert.match(route, /notifyPassengersOfNoShowTrips\(markedNoShowTripIds\)/);
});

test("no-show notification deduplication index is managed and checked", async () => {
  const source = await readFile(
    new URL("../scripts/ensureIndexes.mjs", import.meta.url),
    "utf8",
  );
  assert.match(source, /name: "no_show_trip_notification_unique"/);
  assert.match(source, /partialFilterExpression: \{ type: "no_show_trip" \}/);
  assert.match(
    source,
    /notifications\.createIndex\(\s*NO_SHOW_TRIP_NOTIFICATION_UNIQUE_INDEX\.keys/,
  );
  assert.match(source, /!noShowTripNotificationUniqueReady/);
});

test("no-show review reuses RefundRequest without cancelling the Trip", async () => {
  const source = await readFile(
    new URL("../src/app/api/trips/[id]/cancel/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /body\.action === "request_no_show_review"/);
  assert.match(source, /status: "no_show",\s*paymentStatus: "paid"/);
  assert.match(source, /tier: "no_show_review"/);
  assert.match(source, /refundAmount,\s*retainedAmount: 0/);
  assert.match(source, /Trip\.findOneAndUpdate\([\s\S]*?noShowReviewRequestedAt/);
});
