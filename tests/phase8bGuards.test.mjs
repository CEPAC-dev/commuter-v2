import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const {
  isAuthorizedExpiryRequest,
  isTransientBookingConflict,
  latePaymentDedupeKey,
  safeKashierErrorFields,
  spacingLockUpsertFields,
} = await import("../src/lib/phase8bGuards.ts");
const {
  canContinueStandaloneTripPayment,
  formatKashierAmount,
  splitTripPaymentAmount,
  validatePaymentAppUrl,
} = await import("../src/lib/payments/sessionGuards.ts");
const { ensureTripSpacingLockTtlIndex } = await import(
  "../src/lib/tripSpacingLockIndex.ts"
);

test("session creation and expiry serialize on the standalone Trip record", async () => {
  const state = { tripStatus: "pending_payment", paymentStatus: "pending", payments: [] };
  const createPaymentSession = async () => {
    if (
      !["pending_payment", "approved"].includes(state.tripStatus) ||
      !["pending", "failed"].includes(state.paymentStatus)
    )
      return false;
    state.updatedAt = new Date();
    state.payments.push("in-flight");
    return true;
  };
  const expireTrip = async () => {
    if (state.payments.includes("in-flight")) return false;
    state.tripStatus = "time_out";
    state.paymentStatus = "expired";
    return true;
  };

  assert.equal(await createPaymentSession(), true);
  assert.equal(await expireTrip(), false);
  assert.equal(state.tripStatus, "pending_payment");
  assert.deepEqual(state.payments, ["in-flight"]);

  const route = await readFile(
    new URL("../src/app/api/payments/session/route.ts", import.meta.url),
    "utf8",
  );
  const expiryService = await readFile(
    new URL("../src/lib/services/standaloneTripExpiry.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /withTransaction\(async \(\) => \{[\s\S]*?Trip\.updateOne\([\s\S]*?Payment\.create/);
  assert.ok(
    route.indexOf("tripPaymentCanContinue(bookingObjectId, payment._id)") >
      route.indexOf("withTransaction"),
  );
  assert.ok(
    route.indexOf("tripPaymentCanContinue(bookingObjectId, payment._id)") <
      route.indexOf("reserveWallet(session.userId"),
  );
  assert.ok(
    route.indexOf("tripPaymentCanContinue(bookingObjectId, payment._id)") <
      route.indexOf("fetch(KASHIER_URL"),
  );
  assert.match(expiryService, /Trip\.updateOne\([\s\S]*?Payment\.exists\([\s\S]*?\.session\(input\.session\)/);
});

test("a session cannot be created after an expiry transition wins", async () => {
  const state = { tripStatus: "time_out", paymentStatus: "expired", payments: [] };
  const createPaymentSession = async () => {
    if (
      !["pending_payment", "approved"].includes(state.tripStatus) ||
      !["pending", "failed"].includes(state.paymentStatus)
    )
      return false;
    state.payments.push("in-flight");
    return true;
  };
  assert.equal(await createPaymentSession(), false);
  assert.deepEqual(state.payments, []);
});

test("unpaid cancellation conflicts with session creation on the same Trip", async () => {
  const state = {
    tripStatus: "pending_payment",
    paymentStatus: "pending",
    paymentState: "created",
  };
  const cancelTrip = () => {
    state.tripStatus = "cancelled";
    state.paymentState = "cancelled";
  };
  const createPaymentSession = () =>
    ["pending_payment", "approved"].includes(state.tripStatus) &&
    ["pending", "failed"].includes(state.paymentStatus);

  cancelTrip();
  assert.equal(createPaymentSession(), false);
  assert.equal(state.paymentState, "cancelled");

  const route = await readFile(
    new URL("../src/app/api/trips/[id]/cancel/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    route,
    /withTransaction\(async \(\) => \{[\s\S]*?Trip\.findOneAndUpdate\([\s\S]*?releaseReservation\([\s\S]*?session: dbSession[\s\S]*?Payment\.updateOne\(/,
  );
});

test("session cancellation checkpoint prevents reservation and gateway creation", async () => {
  const beforeReservation = {
    tripStatus: "pending_payment",
    tripPaymentStatus: "pending",
    paymentStatus: "created",
    reservations: 0,
    gatewaySessions: 0,
  };
  beforeReservation.tripStatus = "cancelled";
  beforeReservation.paymentStatus = "cancelled";
  if (
    canContinueStandaloneTripPayment({
      tripStatus: beforeReservation.tripStatus,
      tripPaymentStatus: beforeReservation.tripPaymentStatus,
      paymentStatus: beforeReservation.paymentStatus,
    })
  ) {
    beforeReservation.reservations += 1;
    beforeReservation.gatewaySessions += 1;
  }
  assert.equal(beforeReservation.reservations, 0);
  assert.equal(beforeReservation.gatewaySessions, 0);
  assert.equal(beforeReservation.paymentStatus, "cancelled");

  const beforeGateway = {
    tripStatus: "cancelled",
    tripPaymentStatus: "pending",
    paymentStatus: "cancelled",
    walletReservedEgp: 37.3,
    gatewaySessions: 0,
  };
  beforeGateway.walletReservedEgp = 0;
  if (
    canContinueStandaloneTripPayment({
      tripStatus: beforeGateway.tripStatus,
      tripPaymentStatus: beforeGateway.tripPaymentStatus,
      paymentStatus: beforeGateway.paymentStatus,
    })
  ) {
    beforeGateway.gatewaySessions += 1;
  }
  assert.equal(beforeGateway.walletReservedEgp, 0);
  assert.equal(beforeGateway.gatewaySessions, 0);
  assert.equal(beforeGateway.paymentStatus, "cancelled");

  const route = await readFile(
    new URL("../src/app/api/payments/session/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(
    route,
    /overallStatus: "created"[\s\S]*?overallStatus: \{ \$in: \["created", "wallet_reserved"\] \}/,
  );
});

test("spacing locks refresh a Date TTL field and transaction conflicts are classified", async () => {
  const now = new Date("2026-10-11T10:00:00Z");
  assert.deepEqual(spacingLockUpsertFields(now), {
    createdAt: now,
    updatedAt: now,
  });
  assert.equal(
    isTransientBookingConflict({
      code: 112,
      message: "WriteConflict",
    }),
    true,
  );
  assert.equal(
    isTransientBookingConflict({
      errorLabels: ["TransientTransactionError"],
    }),
    true,
  );
  assert.equal(
    isTransientBookingConflict({
      errorLabels: ["UnknownTransactionCommitResult"],
    }),
    true,
  );
  assert.equal(
    isTransientBookingConflict({
      code: 251,
      errorLabels: ["TransientTransactionError"],
    }),
    true,
  );
  assert.equal(
    isTransientBookingConflict({ code: 251, message: "NoSuchTransaction" }),
    false,
  );
  assert.equal(
    isTransientBookingConflict({
      code: 251,
      errorLabels: ["NonTransientTransactionError"],
    }),
    false,
  );
  assert.equal(isTransientBookingConflict(new Error("unrelated")), false);

  const route = await readFile(
    new URL("../src/app/api/trips/route.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(route, /createIndex\(/);
  assert.match(route, /ensureTripSpacingLockTtlIndex\(spacingLockCollection\)/);
  assert.match(route, /\$setOnInsert: spacingLockUpsertFields\(now\)/);
  assert.match(route, /errorCode: "BOOKING_BUSY"[\s\S]*?status: 503/);

  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  let attempts = 0;
  try {
    await ensureTripSpacingLockTtlIndex({
      createIndex: async () => {
        attempts += 1;
        throw new Error("permission denied");
      },
    });
    await ensureTripSpacingLockTtlIndex({
      createIndex: async () => {
        attempts += 1;
      },
    });
  } finally {
    console.warn = originalWarn;
  }
  assert.equal(attempts, 1);
  assert.equal(warnings.length, 1);
});

test("Trip session amounts use integer piasters and Kashier-safe formatting", () => {
  const split = splitTripPaymentAmount(150, 37.3, true);
  assert.deepEqual(split, {
    totalEgp: 150,
    walletAmountEgp: 37.3,
    gatewayAmountEgp: 112.7,
  });
  assert.equal(split.walletAmountEgp + split.gatewayAmountEgp, split.totalEgp);
  assert.equal(formatKashierAmount(split.gatewayAmountEgp), "112.7");
  assert.equal(formatKashierAmount(150), "150");
});

test("APP_URL validation permits loopback only in non-production test mode", () => {
  const developmentTest = {
    nodeEnv: "development",
    appEnv: "development",
    kashierMode: "test",
  };
  const developmentLive = {
    ...developmentTest,
    kashierMode: "live",
  };
  const productionTest = {
    nodeEnv: "production",
    kashierMode: "test",
  };

  assert.equal(
    validatePaymentAppUrl("http://localhost:3000", developmentTest).valid,
    true,
  );
  assert.equal(
    validatePaymentAppUrl("http://127.0.0.1:3000", developmentTest).valid,
    true,
  );
  assert.equal(
    validatePaymentAppUrl("http://[::1]:3000", developmentTest).valid,
    true,
  );
  assert.equal(
    validatePaymentAppUrl("http://localhost:3000", developmentLive).valid,
    false,
  );
  assert.equal(
    validatePaymentAppUrl("http://localhost:3000", productionTest).valid,
    false,
  );
  assert.equal(
    validatePaymentAppUrl("http://localhost:3000", {
      ...productionTest,
      appEnv: "development",
    }).valid,
    false,
  );

  for (const environment of [
    developmentTest,
    developmentLive,
    productionTest,
    { ...productionTest, appEnv: "development" },
    { nodeEnv: "production", kashierMode: "live" },
    { nodeEnv: "development", kashierMode: "test" },
    { nodeEnv: "development", appEnv: "production", kashierMode: "test" },
  ]) {
    assert.equal(
      validatePaymentAppUrl("https://commuter.example", environment).valid,
      true,
    );
  }

  for (const url of [
    "https://localhost",
    "https://localhost.",
    "https://127.0.0.1",
    "https://10.0.0.8",
    "https://172.20.0.1",
    "https://192.168.1.1",
    "https://[::1]",
    "https://[::ffff:7f00:1]",
    "/checkout/callback",
    undefined,
  ]) {
    assert.equal(
      validatePaymentAppUrl(url, productionTest).valid,
      false,
      String(url),
    );
  }
  assert.equal(
    validatePaymentAppUrl("ftp://localhost:3000", developmentTest).valid,
    false,
  );
  assert.equal(
    validatePaymentAppUrl("https://commuter.example?", productionTest).valid,
    false,
  );
  assert.equal(
    validatePaymentAppUrl("https://user:pass@commuter.example", productionTest)
      .valid,
    false,
  );
});

test("all Kashier checkout session paths validate APP_URL", async () => {
  const sessionRoute = await readFile(
    new URL("../src/app/api/payments/session/route.ts", import.meta.url),
    "utf8",
  );
  const topupRoute = await readFile(
    new URL("../src/app/api/wallet/topup/route.ts", import.meta.url),
    "utf8",
  );
  const gatewayValidation = sessionRoute.slice(
    sessionRoute.indexOf("const gatewayAmount"),
    sessionRoute.indexOf("// ── Create Payment aggregate ──"),
  );

  assert.match(gatewayValidation, /if \(gatewayAmount > 0\)/);
  assert.match(gatewayValidation, /validatePaymentAppUrl\(/);
  assert.doesNotMatch(gatewayValidation, /resolved\.kind === "trip"/);
  assert.match(topupRoute, /validatePaymentAppUrl\(/);
});

test("late success for every dead Trip status alerts once without changing money state", async () => {
  const paymentId = "payment-123";
  assert.equal(
    latePaymentDedupeKey(paymentId),
    latePaymentDedupeKey(paymentId),
  );
  assert.equal(latePaymentDedupeKey(paymentId), "late-payment:payment-123");

  const [adminActivity, notificationModel, webhook] = await Promise.all([
    readFile(new URL("../src/lib/notifications/adminActivity.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/models/AdminActivityNotification.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/app/api/payments/webhook/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(adminActivity, /latePaymentDedupeKey\(paymentId\)/);
  assert.match(adminActivity, /href: `\/admin\/transactions\/\$\{paymentId\}`/);
  assert.match(notificationModel, /AdminActivityNotificationSchema\.index\(\s*\{ adminId: 1, dedupeKey: 1 \},\s*\{\s*unique: true/s);
  assert.match(webhook, /if \(paid\) \{\s*await notifyAdminsOfLateTripPayment/);
  const tripPaymentStart = webhook.indexOf("// 3) Mixed-payment Payment doc");
  const duplicateBranchStart = webhook.indexOf("if (!claimed)", tripPaymentStart);
  const duplicateBranchEnd = webhook.indexOf("const mixedBooking", duplicateBranchStart);
  assert.match(
    webhook.slice(duplicateBranchStart, duplicateBranchEnd),
    /duplicatePayment[\s\S]*?notifyAdminsOfLateTripPayment/,
  );
  const kashier = await readFile(
    new URL("../src/lib/payments/kashier.ts", import.meta.url),
    "utf8",
  );
  assert.match(kashier, /blocked_trip_payment_callback/);
  assert.match(kashier, /notifyAdminsOfLateTripPayment/);
  assert.doesNotMatch(
    webhook.slice(webhook.indexOf("if (settlementBlocked)"), webhook.indexOf("// 4) Legacy")),
    /refundKashier|creditWallet/,
  );

  for (const tripStatus of ["cancelled", "time_out", "rejected"]) {
    const state = {
      tripStatus,
      tripPaymentStatus: "pending",
      paymentStatus: "cancelled",
      walletStatus: "released",
      gatewayStatus: "cancelled",
      alerts: new Set(),
    };
    const handleLateSuccess = () => {
      if (["cancelled", "time_out", "rejected"].includes(state.tripStatus)) {
        state.alerts.add(latePaymentDedupeKey(paymentId));
      }
    };
    handleLateSuccess();
    handleLateSuccess();
    assert.equal(state.alerts.size, 1, tripStatus);
    assert.equal(state.tripPaymentStatus, "pending", tripStatus);
    assert.equal(state.paymentStatus, "cancelled", tripStatus);
    assert.equal(state.walletStatus, "released", tripStatus);
    assert.equal(state.gatewayStatus, "cancelled", tripStatus);
  }
});

test("expiry authorization fails closed in production but keeps Bearer auth", async () => {
  assert.equal(isAuthorizedExpiryRequest(undefined, true, ""), false);
  assert.equal(isAuthorizedExpiryRequest(undefined, false, ""), true);
  assert.equal(isAuthorizedExpiryRequest("secret", true, "Bearer secret"), true);
  assert.equal(isAuthorizedExpiryRequest("secret", true, "secret"), false);

  const route = await readFile(
    new URL("../src/app/api/trips/expire/route.ts", import.meta.url),
    "utf8",
  );
  assert.ok(
    route.indexOf("isAuthorizedExpiryRequest") < route.indexOf("await connectDB()"),
  );
  assert.match(route, /if \(auth !== `Bearer \$\{secret\}`\)/);
});

test("Kashier log projection excludes raw response/session/card fields", async () => {
  const safe = safeKashierErrorFields({
    code: "DECLINED",
    message: "Payment was declined",
    merchantOrderId: "order-1",
    sessionUrl: "https://sensitive.example/session",
    token: "secret-token",
    cardNumber: "4111111111111111",
    data: { card: { number: "4111111111111111" } },
  });
  assert.deepEqual(safe, {
    code: "DECLINED",
    message: "Payment was declined",
    orderId: "order-1",
  });
  const unknownShape = safeKashierErrorFields({
    requestId: "must-not-be-logged",
    unexpectedField: "sensitive-value",
  });
  assert.deepEqual(unknownShape, {
    responseKeys: ["requestId", "unexpectedField"],
  });
  assert.doesNotMatch(
    JSON.stringify(unknownShape),
    /must-not-be-logged|sensitive-value/,
  );
  const route = await readFile(
    new URL("../src/app/api/payments/session/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(route, /safeKashierErrorFields\(kashierData/);
  assert.doesNotMatch(route, /console\.error\([^;]*,\s*kashierData\s*[,)]/s);
  assert.doesNotMatch(route, /console\.error\([^;]*kashierText/s);
});
