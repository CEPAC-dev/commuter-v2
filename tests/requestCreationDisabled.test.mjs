import test from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";

const { Request } = await import("../src/models/Request.ts");

const creationError = /Request creation is disabled; create a Trip instead/;

function makeRequest(overrides = {}) {
  return {
    _id: new Types.ObjectId(),
    userId: new Types.ObjectId(),
    dates: ["2026-10-11"],
    amountEgp: 500,
    paymentStatus: "pending",
    status: "pending_payment",
    ...overrides,
  };
}

test("saving a new Request is rejected", async () => {
  await assert.rejects(
    new Request(makeRequest()).save(),
    creationError,
  );
});

test("Request.create is rejected", async () => {
  await assert.rejects(Request.create(makeRequest()), creationError);
});

test("Request.insertMany is rejected", async () => {
  await assert.rejects(Request.insertMany([makeRequest()]), creationError);
});

test("Request upserts are rejected across query update methods", async () => {
  await assert.rejects(
    Request.updateOne(
      { _id: new Types.ObjectId() },
      { $set: { status: "approved" } },
      { upsert: true },
    ).exec(),
    creationError,
  );
  await assert.rejects(
    Request.findOneAndUpdate(
      { _id: new Types.ObjectId() },
      { $set: { status: "approved" } },
      { upsert: true },
    ).exec(),
    creationError,
  );
});

test("bulkWrite cannot insert or upsert a Request", async () => {
  await assert.rejects(
    Request.bulkWrite([{ insertOne: { document: makeRequest() } }]),
    creationError,
  );
  await assert.rejects(
    Request.bulkWrite([
      {
        updateOne: {
          filter: { _id: new Types.ObjectId() },
          update: { $set: { status: "approved" } },
          upsert: true,
        },
      },
    ]),
    creationError,
  );
});

test("saving and updating an existing Request remain allowed", async () => {
  const collection = Request.collection;
  const originalUpdateOne = collection.updateOne;
  const originalFindOneAndUpdate = collection.findOneAndUpdate;
  let updateCalls = 0;
  collection.updateOne = async () => {
    updateCalls += 1;
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  };
  collection.findOneAndUpdate = async () => {
    updateCalls += 1;
    return makeRequest({ status: "approved" });
  };

  try {
    const request = Request.hydrate(makeRequest());
    request.status = "approved";
    await request.save();
    await Request.updateOne(
      { _id: request._id },
      { $set: { paymentStatus: "paid" } },
    ).exec();
    await Request.findOneAndUpdate(
      { _id: request._id, status: "waiting_list" },
      { $set: { status: "approved" } },
    ).exec();
    assert.equal(updateCalls, 3);
  } finally {
    collection.updateOne = originalUpdateOne;
    collection.findOneAndUpdate = originalFindOneAndUpdate;
  }
});
