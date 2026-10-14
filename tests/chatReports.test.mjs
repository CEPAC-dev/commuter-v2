import test from "node:test";
import assert from "node:assert/strict";

const {
  buildChatReportSnapshot,
  CHAT_REPORT_OPEN_UNIQUE_INDEX,
  isAlreadyReported,
  validateChatReportInput,
} = await import("../src/lib/chatReports.ts");

test("chat report validation permits supported reasons and trims optional notes", () => {
  assert.deepEqual(
    validateChatReportInput({ reason: "contact_sharing", note: "  Details  " }),
    { ok: true, reason: "contact_sharing", note: "Details" },
  );
  assert.deepEqual(
    validateChatReportInput({ reason: "other", note: "  " }),
    { ok: true, reason: "other" },
  );
});

test("chat report validation rejects invalid reasons and notes over 300 characters", () => {
  assert.deepEqual(
    validateChatReportInput({ reason: "unknown" }),
    { ok: false, errorCode: "INVALID_REPORT_REASON" },
  );
  assert.deepEqual(
    validateChatReportInput({ reason: "abuse", note: 12 }),
    { ok: false, errorCode: "INVALID_REPORT_NOTE" },
  );
  assert.deepEqual(
    validateChatReportInput({ reason: "abuse", note: "x".repeat(301) }),
    { ok: false, errorCode: "REPORT_NOTE_TOO_LONG" },
  );
});

test("only an existing open report triggers the duplicate-report rule", () => {
  assert.equal(isAlreadyReported(true), true);
  assert.equal(isAlreadyReported(false), false);

  assert.deepEqual(CHAT_REPORT_OPEN_UNIQUE_INDEX, {
    keys: { reporterId: 1, tripId: 1 },
    options: {
      unique: true,
      partialFilterExpression: { status: "open" },
    },
  });
});

test("report snapshots contain only the approved message evidence fields", () => {
  const snapshot = buildChatReportSnapshot([
    {
      _id: "message-id",
      senderId: "private-user-id",
      senderRole: "driver",
      kind: "text",
      text: "I'll wait at the pickup.",
      createdAt: new Date("2026-04-01T10:00:00.000Z"),
    },
    {
      _id: "preset-message-id",
      senderId: "private-driver-id",
      senderRole: "user",
      kind: "preset",
      presetKey: "at_pickup",
      createdAt: new Date("2026-04-01T10:01:00.000Z"),
    },
  ]);

  assert.deepEqual(snapshot, [
    {
      senderRole: "driver",
      kind: "text",
      text: "I'll wait at the pickup.",
      createdAt: new Date("2026-04-01T10:00:00.000Z"),
    },
    {
      senderRole: "user",
      kind: "preset",
      presetKey: "at_pickup",
      createdAt: new Date("2026-04-01T10:01:00.000Z"),
    },
  ]);
  assert.equal("senderId" in snapshot[0], false);
  assert.equal("_id" in snapshot[0], false);
});
