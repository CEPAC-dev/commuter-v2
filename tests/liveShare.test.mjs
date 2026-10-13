import test from "node:test";
import assert from "node:assert/strict";

const {
  MAX_LOCATION_ACCURACY_METERS,
  SHARE_END_GRACE_MS,
  SHARE_MIN_UPDATE_INTERVAL_MS,
  SHARE_VIEW_COUNT_INTERVAL_MS,
  projectPublicTrip,
  revokeShareLocation,
  updateShareLocation,
  validateLocationInput,
} = await import("../src/lib/liveShare/logic.ts");
const { canShare, detectedTripEndAt, isEnded } = await import(
  "../src/lib/liveShare/eligibility.ts"
);
const { readPublicShare, INVALID_PUBLIC_SHARE } = await import(
  "../src/lib/liveShare/public.ts"
);
const { createShareToken, verifyShareToken } = await import(
  "../src/lib/liveShare/token.ts"
);
const {
  TRIP_SHARE_ACTIVE_INDEX,
  TRIP_SHARE_DELETE_AT_INDEX,
} = await import("../src/lib/liveShare/indexes.ts");

const SECRET = "live-share-test-secret-with-enough-randomness";
const SHARE_ID = "0123456789abcdef01234567";
const NOW = new Date("2026-10-12T07:00:00.000Z");

function makeTrip(overrides = {}) {
  return {
    userId: "passenger-1",
    driverId: "driver-1",
    status: "active",
    pickup: { address: "Pickup", lat: 30.1, lng: 31.2 },
    dropoff: { address: "Dropoff", lat: 30.2, lng: 31.3 },
    assignedDriver: {
      name: "Sam Driver",
      carBrand: "Make",
      carModel: "Model",
      vehicleColor: "Blue",
      plateChar1: "A",
      plateChar2: "B",
      plateChar3: "C",
      plateDigits: "1234",
      phone: "+201000000000",
      profilePic: "/private/photo.jpg",
      nationalId: "private-id",
      payoutAccountNumber: "private-account",
    },
    ...overrides,
  };
}

function makeShare(overrides = {}) {
  return {
    id: SHARE_ID,
    active: true,
    revokedAt: null,
    endedAt: null,
    expiresAt: new Date(NOW.getTime() + 60 * 60 * 1000),
    lastLocation: null,
    viewCount: 0,
    lastViewedAt: null,
    ...overrides,
  };
}

function makeLocation(receivedAt = NOW) {
  return {
    lat: 30.05,
    lng: 31.24,
    accuracy: 12,
    heading: 80,
    speed: 4,
    recordedAt: NOW,
    receivedAt,
  };
}

class MemoryLocationStore {
  constructor({ share = makeShare(), trip = makeTrip(), ride = null } = {}) {
    this.context = { share, trip, ride };
    this.writes = 0;
    this.markedEndedAt = null;
  }

  async load(shareId) {
    return shareId === this.context.share.id ? this.context : null;
  }

  async markEnded(_shareId, endedAt) {
    this.markedEndedAt = endedAt;
    this.context.share.endedAt = endedAt;
    this.context.share.lastLocation = null;
  }

  async updateLocationIfDue(input) {
    this.writes += 1;
    const share = this.context.share;
    const receivedAt = share.lastLocation?.receivedAt?.getTime();
    if (
      !share.active ||
      share.revokedAt ||
      share.endedAt ||
      share.expiresAt <= input.now ||
      (receivedAt !== undefined &&
        receivedAt > input.earliestReceivedAt.getTime())
    ) {
      return false;
    }
    share.lastLocation = { ...input.location, receivedAt: input.now };
    return true;
  }
}

class MemoryPublicStore {
  constructor({
    share = makeShare(),
    trip = makeTrip(),
    ride = null,
  } = {}) {
    this.context = { share, trip, ride };
    this.viewTouches = 0;
    this.failedAttempts = 0;
  }

  async load(shareId) {
    return shareId === this.context.share.id ? this.context : null;
  }

  async markEnded(_shareId, endedAt) {
    this.context.share.endedAt = endedAt;
    this.context.share.lastLocation = null;
  }

  async touchViewer(_shareId, now, cutoff) {
    const lastViewedAt = this.context.share.lastViewedAt;
    if (!lastViewedAt || lastViewedAt <= cutoff) {
      this.viewTouches += 1;
      this.context.share.viewCount += 1;
      this.context.share.lastViewedAt = now;
    }
  }
}

test("share token signs and verifies a share id", () => {
  const token = createShareToken(SHARE_ID, SECRET);
  assert.equal(verifyShareToken(token, SECRET), SHARE_ID);
});

test("share token rejects a tampered signature and wrong secret", () => {
  const token = createShareToken(SHARE_ID, SECRET);
  const [id, signature] = token.split(".");
  const changedSignature = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
  assert.equal(verifyShareToken(`${id}.${changedSignature}`, SECRET), null);
  assert.equal(verifyShareToken(token, `${SECRET}-wrong`), null);
});

test("share token rejects malformed input without throwing", () => {
  for (const token of [null, 12, "", "not-a-token", `${SHARE_ID}.short`, `${"g".repeat(24)}.${"A".repeat(43)}`]) {
    assert.doesNotThrow(() => verifyShareToken(token, SECRET));
    assert.equal(verifyShareToken(token, SECRET), null);
  }
});

test("share token requires an explicitly configured secret", () => {
  assert.equal(
    verifyShareToken(
      createShareToken(SHARE_ID, "s".repeat(32)),
      "s".repeat(32),
    ),
    SHARE_ID,
  );
});

test("eligibility requires ownership, an assigned driver, and a confirmed or active status", () => {
  const trip = makeTrip();
  assert.equal(canShare(trip, "passenger-1"), true);
  assert.equal(canShare(trip, "someone-else"), false);
  assert.equal(canShare({ ...trip, driverId: null }, "passenger-1"), false);
  assert.equal(canShare({ ...trip, status: "matched" }, "passenger-1"), false);
  assert.equal(
    canShare({ ...trip, status: "matched" }, "passenger-1", { status: "confirmed" }),
    true,
  );
  assert.equal(
    canShare(
      { ...trip, status: "submitted" },
      "passenger-1",
      { status: "active" },
    ),
    true,
  );
});

test("private trips without a Ride can share when the assigned Trip is confirmed or active", () => {
  assert.equal(
    canShare(
      makeTrip({ status: "confirmed", rideId: null }),
      "passenger-1",
      null,
    ),
    true,
  );
  assert.equal(
    canShare(makeTrip({ status: "matched", rideId: null }), "passenger-1", null),
    false,
  );
});

test("ended eligibility includes all terminal Trip and Ride states", () => {
  for (const status of ["completed", "cancelled", "refunded", "time_out", "nomatch"]) {
    assert.equal(isEnded({ status }), true, status);
  }
  for (const status of ["completed", "cancelled"]) {
    assert.equal(isEnded({ status: "active" }, { status }), true, status);
  }
  assert.equal(isEnded({ status: "active" }, { status: "confirmed" }), false);
});

test("detected trip end time uses the terminal status timestamp for delayed polling", () => {
  const endedAt = new Date(NOW.getTime() - SHARE_END_GRACE_MS - 1);
  assert.equal(
    detectedTripEndAt(
      { status: "completed", updatedAt: endedAt },
      null,
      NOW,
    ).getTime(),
    endedAt.getTime(),
  );
});

test("location validation accepts supported readings and rejects invalid, stale, future, or inaccurate data", () => {
  const valid = validateLocationInput(
    {
      lat: -90,
      lng: 180,
      accuracy: MAX_LOCATION_ACCURACY_METERS,
      heading: 360,
      speed: 0,
      recordedAt: NOW.toISOString(),
    },
    NOW,
  );
  assert.equal(valid.valid, true);

  for (const input of [
    { lat: Number.NaN, lng: 31, recordedAt: NOW },
    { lat: 91, lng: 31, recordedAt: NOW },
    { lat: 30, lng: -181, recordedAt: NOW },
    { lat: 30, lng: 31, heading: 361, recordedAt: NOW },
    { lat: 30, lng: 31, speed: -1, recordedAt: NOW },
    { lat: 30, lng: 31, recordedAt: new Date(NOW.getTime() - 120_001) },
    { lat: 30, lng: 31, recordedAt: new Date(NOW.getTime() + 30_001) },
  ]) {
    assert.equal(validateLocationInput(input, NOW).valid, false);
  }
  const overAccuracyCap = validateLocationInput(
    {
      lat: 30,
      lng: 31,
      accuracy: MAX_LOCATION_ACCURACY_METERS + 1,
      recordedAt: NOW,
    },
    NOW,
  );
  assert.equal(overAccuracyCap.valid, false);
  assert.equal(overAccuracyCap.errorCode, "LOCATION_ACCURACY_TOO_LOW");
});

test("location updates use the minimum interval and return a retry delay", async () => {
  const store = new MemoryLocationStore();
  const first = await updateShareLocation(
    {
      shareId: SHARE_ID,
      ownerId: "passenger-1",
      location: makeLocation(),
      now: NOW,
    },
    store,
  );
  assert.deepEqual(first, {
    kind: "updated",
    ok: true,
    nextAfterMs: SHARE_MIN_UPDATE_INTERVAL_MS,
  });

  const second = await updateShareLocation(
    {
      shareId: SHARE_ID,
      ownerId: "passenger-1",
      location: makeLocation(),
      now: new Date(NOW.getTime() + 1_000),
    },
    store,
  );
  assert.deepEqual(second, { kind: "too_soon", ok: false, nextAfterMs: 2_000 });
  assert.equal(store.writes, 2);
});

test("location updates reject revoked and expired shares and mark ended trips", async () => {
  for (const share of [
    makeShare({ active: false, revokedAt: NOW }),
    makeShare({ expiresAt: new Date(NOW.getTime() - 1) }),
  ]) {
    const store = new MemoryLocationStore({ share });
    const result = await updateShareLocation(
      { shareId: SHARE_ID, ownerId: "passenger-1", location: makeLocation(), now: NOW },
      store,
    );
    assert.equal(result.kind, "not_found");
    assert.equal(store.writes, 0);
  }

  const endedStore = new MemoryLocationStore({
    trip: makeTrip({ status: "completed" }),
    share: makeShare({ lastLocation: makeLocation() }),
  });
  const ended = await updateShareLocation(
    { shareId: SHARE_ID, ownerId: "passenger-1", location: makeLocation(), now: NOW },
    endedStore,
  );
  assert.equal(ended.kind, "ended");
  assert.equal(endedStore.context.share.lastLocation, null);
  assert.equal(endedStore.markedEndedAt, NOW);
  assert.equal(endedStore.writes, 0);
});

test("public trip projection exposes only allowlisted values and hides sensitive snapshot fields", () => {
  const projection = projectPublicTrip(
    makeTrip(),
    makeLocation(),
    NOW,
  );
  assert.deepEqual(Object.keys(projection).sort(), [
    "driver",
    "dropoff",
    "location",
    "pickup",
    "serverTime",
    "state",
    "tripStatus",
  ]);
  assert.deepEqual(Object.keys(projection.location).sort(), [
    "accuracy",
    "ageSeconds",
    "heading",
    "lat",
    "lng",
    "recordedAt",
  ]);
  assert.deepEqual(Object.keys(projection.driver).sort(), [
    "firstName",
    "vehicle",
  ]);
  assert.deepEqual(Object.keys(projection.driver.vehicle).sort(), [
    "color",
    "make",
    "model",
    "plate",
  ]);
  assert.equal(projection.driver.firstName, "Sam");
  assert.equal(projection.driver.vehicle.plate, "A B C 1234");
  assert.deepEqual(Object.keys(projection.pickup).sort(), ["lat", "lng"]);
  assert.deepEqual(Object.keys(projection.dropoff).sort(), ["lat", "lng"]);
  assert.equal("address" in projection.pickup, false);
  assert.equal("address" in projection.dropoff, false);
  assert.equal(
    JSON.stringify(projection).includes("private-account"),
    false,
  );
  assert.equal(JSON.stringify(projection).includes("+201000000000"), false);
  assert.equal(JSON.stringify(projection).includes("nationalId"), false);
  assert.equal(projection.state, "live");

  const waiting = projectPublicTrip(makeTrip(), null, NOW);
  assert.equal(waiting.state, "waiting");
  assert.equal(waiting.location, null);
  const stale = projectPublicTrip(
    makeTrip(),
    makeLocation(new Date(NOW.getTime() - 45_000)),
    NOW,
  );
  assert.equal(stale.state, "stale");
});

test("all failed public token cases produce one generic 404 response", async () => {
  const expiredAt = new Date(NOW.getTime() - 1);
  const cases = [
    {
      token: "malformed",
      store: new MemoryPublicStore(),
    },
    {
      token: `${SHARE_ID}.${"A".repeat(43)}`,
      store: new MemoryPublicStore(),
    },
    {
      token: createShareToken("111111111111111111111111", SECRET),
      store: new MemoryPublicStore({ share: makeShare({ id: SHARE_ID }) }),
    },
    {
      token: createShareToken(SHARE_ID, SECRET),
      store: new MemoryPublicStore({
        share: makeShare({ revokedAt: NOW }),
      }),
    },
    {
      token: createShareToken(SHARE_ID, SECRET),
      store: new MemoryPublicStore({
        share: makeShare({ expiresAt: expiredAt }),
      }),
    },
  ];
  const responses = [];
  for (const { token, store } of cases) {
    responses.push(
      await readPublicShare(
        { token, secret: SECRET, now: NOW },
        store,
        async () => {
          store.failedAttempts += 1;
        },
      ),
    );
  }
  for (const response of responses) {
    assert.deepEqual(response, {
      status: 404,
      body: INVALID_PUBLIC_SHARE,
    });
  }
  assert.deepEqual(
    cases.map(({ store }) => store.failedAttempts),
    [0, 0, 1, 1, 1],
  );
});

test("signed unavailable tokens return 429 and Retry-After when the limiter blocks", async () => {
  const result = await readPublicShare(
    {
      token: createShareToken("111111111111111111111111", SECRET),
      secret: SECRET,
      now: NOW,
    },
    new MemoryPublicStore(),
    async () => "17",
  );
  assert.deepEqual(result, {
    status: 429,
    body: INVALID_PUBLIC_SHARE,
    headers: { "Retry-After": "17" },
  });
});

test("ended shares clear location and return a location-free grace response", async () => {
  const store = new MemoryPublicStore({
    trip: makeTrip({ status: "completed" }),
    share: makeShare({ lastLocation: makeLocation() }),
  });
  const result = await readPublicShare(
    { token: createShareToken(SHARE_ID, SECRET), secret: SECRET, now: NOW },
    store,
    async () => {
      store.failedAttempts += 1;
    },
  );
  assert.deepEqual(result, { status: 200, body: { state: "ended" } });
  assert.equal(store.context.share.lastLocation, null);
  assert.equal(store.context.share.endedAt, NOW);

  const expiredGrace = new MemoryPublicStore({
    trip: makeTrip({ status: "completed" }),
    share: makeShare({
      endedAt: new Date(NOW.getTime() - SHARE_END_GRACE_MS - 1),
    }),
  });
  const afterGrace = await readPublicShare(
    {
      token: createShareToken(SHARE_ID, SECRET),
      secret: SECRET,
      now: NOW,
    },
    expiredGrace,
    async () => {
      expiredGrace.failedAttempts += 1;
    },
  );
  assert.deepEqual(afterGrace, { status: 404, body: INVALID_PUBLIC_SHARE });
});

test("valid public polling touches the view counter no more than once per minute", async () => {
  const store = new MemoryPublicStore();
  const token = createShareToken(SHARE_ID, SECRET);
  for (const elapsed of [0, 10_000, 20_000, 61_000]) {
    await readPublicShare(
      { token, secret: SECRET, now: new Date(NOW.getTime() + elapsed) },
      store,
      async () => {
        store.failedAttempts += 1;
      },
    );
  }
  assert.equal(store.viewTouches, 2);
  assert.equal(store.failedAttempts, 0);
  assert.equal(SHARE_VIEW_COUNT_INTERVAL_MS, 60_000);
});

test("revocation clears the stored latest location", async () => {
  const store = {
    share: makeShare({ lastLocation: makeLocation() }),
    async revokeAndClear(shareId, revokedAt) {
      assert.equal(shareId, SHARE_ID);
      this.share.active = false;
      this.share.revokedAt = revokedAt;
      this.share.lastLocation = null;
      return true;
    },
  };
  assert.equal(await revokeShareLocation(SHARE_ID, NOW, store), true);
  assert.equal(store.share.active, false);
  assert.equal(store.share.revokedAt, NOW);
  assert.equal(store.share.lastLocation, null);
});

test("TripShare schema declares one-active-share and expiry TTL indexes", () => {
  assert.deepEqual(TRIP_SHARE_ACTIVE_INDEX.keys, { tripId: 1, userId: 1 });
  assert.deepEqual(TRIP_SHARE_ACTIVE_INDEX.options, {
    unique: true,
    partialFilterExpression: { active: true },
    name: "trip_user_one_active_share",
  });
  assert.deepEqual(TRIP_SHARE_DELETE_AT_INDEX.keys, { deleteAt: 1 });
  assert.deepEqual(TRIP_SHARE_DELETE_AT_INDEX.options, {
    expireAfterSeconds: 0,
    name: "trip_share_delete_at_ttl",
  });
});
