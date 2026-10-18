import test from "node:test";
import assert from "node:assert/strict";

const {
  buildUnreadMessageMatch,
  countUnreadChatMessages,
  getUnreadParticipants,
  parseChatTripIds,
} = await import("../src/lib/chatUnread.ts");

const tripId = "aaaaaaaaaaaaaaaaaaaaaaaa";
const anotherTripId = "bbbbbbbbbbbbbbbbbbbbbbbb";
const readAt = new Date("2026-10-14T12:00:00.000Z");

const messages = [
  { tripId, senderRole: "driver", createdAt: "2026-10-14T11:59:00.000Z" },
  { tripId, senderRole: "user", createdAt: "2026-10-14T12:01:00.000Z" },
  { tripId, senderRole: "driver", createdAt: "2026-10-14T12:01:00.000Z" },
  { tripId, senderRole: "driver", createdAt: "2026-10-14T12:02:00.000Z" },
  { tripId: anotherTripId, senderRole: "driver", createdAt: "2026-10-14T12:02:00.000Z" },
];

test("unread count excludes caller messages and messages from before last read", () => {
  assert.equal(
    countUnreadChatMessages(messages, {
      tripId,
      callerRole: "passenger",
      lastReadAt: readAt,
    }),
    2,
  );
});

test("unread count includes all other-side messages when there is no read state", () => {
  assert.equal(
    countUnreadChatMessages(messages, {
      tripId,
      callerRole: "passenger",
      lastReadAt: null,
    }),
    3,
  );
});

test("unread count ignores messages belonging to another Trip", () => {
  assert.equal(
    countUnreadChatMessages(messages, {
      tripId,
      callerRole: "passenger",
      lastReadAt: null,
    }),
    3,
  );
});

test("driver unread matching counts passenger messages, not the driver's own", () => {
  assert.equal(
    countUnreadChatMessages(messages, {
      tripId,
      callerRole: "driver",
      lastReadAt: null,
    }),
    1,
  );
  assert.deepEqual(
    buildUnreadMessageMatch([
      { tripId, role: "driver", lastReadAt: null },
    ]),
    [{ tripId, senderRole: "user" }],
  );
});

test("trip ID parser deduplicates valid IDs and drops malformed IDs", () => {
  assert.deepEqual(parseChatTripIds(`${tripId},bad,${tripId}`), {
    ids: [tripId],
    tooMany: false,
  });
});

test("trip ID parser rejects more than ten requested IDs", () => {
  const tenIds = Array.from({ length: 10 }, (_, index) =>
    index.toString(16).padStart(24, "0"),
  );
  assert.equal(parseChatTripIds(tenIds.join(",")).tooMany, false);
  assert.equal(parseChatTripIds([...tenIds, anotherTripId].join(",")).tooMany, true);
});

test("unread participants silently exclude other passengers and admins", () => {
  const trip = {
    _id: tripId,
    userId: "passenger-1",
    rideId: "cccccccccccccccccccccccc",
    status: "confirmed",
  };
  const ride = {
    _id: trip.rideId,
    driverId: "driver-1",
    status: "active",
    passengers: [{ tripId, status: "waiting" }],
  };
  const candidates = [{ trip, ride, lastReadAt: null }];

  assert.deepEqual(
    getUnreadParticipants({
      session: { userId: "passenger-2", role: "passenger" },
      candidates,
    }),
    [],
  );
  assert.deepEqual(
    getUnreadParticipants({
      session: { userId: "admin-1", role: "admin" },
      candidates,
    }),
    [],
  );
  assert.deepEqual(
    getUnreadParticipants({
      session: { userId: "passenger-1", role: "passenger" },
      candidates,
    }),
    [{ tripId, role: "passenger", lastReadAt: null }],
  );
});
