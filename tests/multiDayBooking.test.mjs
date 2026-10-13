import test from "node:test";
import assert from "node:assert/strict";

const { multiDayBookingCountKey } = await import("../src/lib/i18n/multiDayBooking.ts");
const { ar } = await import("../src/lib/i18n/messages/ar.ts");
const { en } = await import("../src/lib/i18n/messages/en.ts");

const toArabicDigits = (value) =>
  String(value).replace(/[0-9]/g, (digit) => "٠١٢٣٤٥٦٧٨٩"[Number(digit)]);

function formatArabicBooking(count) {
  const key = multiDayBookingCountKey("ar", count);
  return ar[key]
    .replaceAll("{count}", toArabicDigits(count))
    .replaceAll("{plural}", count === 1 ? "" : "s");
}

test("Arabic multi-day booking uses singular form for one remaining day", () => {
  assert.equal(formatArabicBooking(1), "حجز متعدد الأيام · يوم واحد");
});

test("Arabic multi-day booking uses dual form for two days", () => {
  assert.equal(formatArabicBooking(2), "حجز متعدد الأيام · يومان");
});

test("Arabic multi-day booking uses plural form for three and seven days", () => {
  assert.equal(formatArabicBooking(3), "حجز متعدد الأيام · ٣ أيام");
  assert.equal(formatArabicBooking(7), "حجز متعدد الأيام · ٧ أيام");
});

test("Arabic multi-day booking uses accusative plural for eleven or more days", () => {
  assert.equal(formatArabicBooking(11), "حجز متعدد الأيام · ١١ يومًا");
});

test("English multi-day booking keeps its existing wording", () => {
  const key = multiDayBookingCountKey("en", 3);
  assert.equal(
    en[key].replaceAll("{count}", "3").replaceAll("{plural}", "s"),
    "Multi-day booking · 3 days",
  );
});
