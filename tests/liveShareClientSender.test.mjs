import test from "node:test";
import assert from "node:assert/strict";

const {
  LOCATION_SEND_INTERVAL_MS,
  NETWORK_RETRY_MAX_MS,
  buildLiveShareText,
  buildSmsShareUrl,
  buildWhatsAppShareUrl,
  classifyLocationError,
  getLocationSendDelayMs,
  getNetworkRetryDelayMs,
  shouldSendLocationNow,
} = await import("../src/lib/liveShare/clientSender.ts");
const { en } = await import("../src/lib/i18n/messages/en.ts");
const { ar } = await import("../src/lib/i18n/messages/ar.ts");

const LINK = "https://commuter.example/live/share.signature";

test("location updates send immediately once, then respect the 10-second and server delays", () => {
  assert.equal(shouldSendLocationNow(10_000, null), true);
  assert.equal(getLocationSendDelayMs(10_000, null, 4_000), 4_000);
  assert.equal(
    getLocationSendDelayMs(20_000, 15_000, 0),
    LOCATION_SEND_INTERVAL_MS - 5_000,
  );
  assert.equal(getLocationSendDelayMs(20_000, 15_000, 8_000), 8_000);
  assert.equal(shouldSendLocationNow(25_000, 15_000, 0), true);
  assert.equal(shouldSendLocationNow(24_999, 15_000, 0), false);
});

test("location errors are classified for actionable passenger messages", () => {
  assert.equal(classifyLocationError({ geolocationCode: 1 }), "permission");
  assert.equal(classifyLocationError({ geolocationCode: 2 }), "unavailable");
  assert.equal(classifyLocationError({ geolocationCode: 3 }), "timeout");
  assert.equal(classifyLocationError({ accuracy: 1_001 }), "weak_accuracy");
  assert.equal(
    classifyLocationError({ errorCode: "LOCATION_ACCURACY_TOO_LOW" }),
    "weak_accuracy",
  );
  assert.equal(classifyLocationError({ status: 409 }), "ended");
  assert.equal(classifyLocationError({ state: "ended" }), "ended");
  assert.equal(classifyLocationError({ network: true }), "network");
});

test("network retry delay grows exponentially and remains capped", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 4].map(getNetworkRetryDelayMs),
    [1_000, 2_000, 4_000, 8_000, 16_000],
  );
  assert.equal(getNetworkRetryDelayMs(20), NETWORK_RETRY_MAX_MS);
  assert.equal(getNetworkRetryDelayMs(-1), 1_000);
});

test("share links contain only the fixed localized text and supplied link", () => {
  for (const locale of ["en", "ar"]) {
    const message =
      locale === "ar" ? ar["live_share.share_message"] : en["live_share.share_message"];
    const expected = message.replace("{url}", LINK);
    assert.equal(buildLiveShareText(locale, LINK), expected);

    const whatsapp = new URL(buildWhatsAppShareUrl(locale, LINK));
    assert.equal(whatsapp.origin, "https://wa.me");
    assert.deepEqual([...whatsapp.searchParams.keys()], ["text"]);
    assert.equal(whatsapp.searchParams.get("text"), expected);

    const sms = new URL(buildSmsShareUrl(locale, LINK));
    assert.equal(sms.protocol, "sms:");
    assert.deepEqual([...sms.searchParams.keys()], ["body"]);
    assert.equal(sms.searchParams.get("body"), expected);
    assert.equal((expected.match(/https?:\/\//g) ?? []).length, 1);
    assert.equal(expected.includes(LINK), true);
  }
});

test("English and Arabic message keys match for live sharing", () => {
  const englishKeys = Object.keys(en).filter((key) => key.startsWith("live_share."));
  const arabicKeys = Object.keys(ar).filter((key) => key.startsWith("live_share."));
  assert.deepEqual(arabicKeys.sort(), englishKeys.sort());
  assert.ok(englishKeys.length > 0);
});
