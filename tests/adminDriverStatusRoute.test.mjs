import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const stateKey = "commuter.admin.driver-status-route-test";
const state = {
  authorized: true,
  authCalls: 0,
  connectCalls: 0,
  findCalls: 0,
  writes: [],
  driver: null,
};
globalThis[Symbol.for(stateKey)] = state;

const mockedModules = new Map([
  [
    "@/lib/middleware/adminAuth",
    `export async function adminAuth() {
      const state = globalThis[Symbol.for(${JSON.stringify(stateKey)})];
      state.authCalls += 1;
      return state.authorized
        ? { authorized: true, userId: "admin" }
        : { authorized: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
    }`,
  ],
  [
    "@/lib/db/mongoose",
    `export async function connectDB() {
      globalThis[Symbol.for(${JSON.stringify(stateKey)})].connectCalls += 1;
    }`,
  ],
  [
    "@/models/Driver",
    `const state = globalThis[Symbol.for(${JSON.stringify(stateKey)})];
    export const Driver = {
      async findById() {
        state.findCalls += 1;
        return state.driver;
      },
      async findByIdAndUpdate(_id, update) {
        state.writes.push(update);
        state.driver = { ...state.driver, ...update };
        return state.driver;
      },
    };`,
  ],
]);

registerHooks({
  resolve(specifier, context, nextResolve) {
    const source = mockedModules.get(specifier);
    if (source) {
      return {
        url: `data:text/javascript,${encodeURIComponent(source)}`,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
});

const { PATCH } = await import(
  "../src/app/api/admin/drivers/[id]/status/route.ts"
);

const driverId = "507f1f77bcf86cd799439011";
const vehicleFields = {
  carType: "private",
  carBrand: "Toyota",
  carModel: "Corolla",
  modelYear: 2022,
  vehicleColor: "White",
  plateChar1: "A",
  plateChar2: "B",
  plateChar3: "C",
  plateDigits: "1234",
  licenseExpiry: "2027-08-23",
};
const documentFields = [
  "nationalIdFront",
  "nationalIdBack",
  "drivingLicense",
  "carLicenseFront",
  "carLicenseBack",
  "criminalRecord",
  "profilePic",
  "carImage",
];

function completeDriver(verificationStatus = "pending") {
  return {
    _id: driverId,
    verificationStatus,
    ...vehicleFields,
    documents: Object.fromEntries(documentFields.map((field) => [field, `/uploads/${field}.jpg`])),
  };
}

function resetState() {
  state.authorized = true;
  state.authCalls = 0;
  state.connectCalls = 0;
  state.findCalls = 0;
  state.writes = [];
  state.driver = completeDriver();
}

beforeEach(resetState);

async function patchStatus(status) {
  const request = new Request(
    `http://localhost/api/admin/drivers/${driverId}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verificationStatus: status }),
    },
  );
  return PATCH(request, { params: Promise.resolve({ id: driverId }) });
}

test("non-admin requests are rejected before database access", async () => {
  state.authorized = false;

  const response = await patchStatus("verified");

  assert.equal(response.status, 401);
  assert.equal(state.authCalls, 1);
  assert.equal(state.connectCalls, 0);
});

test("invalid status is rejected", async () => {
  const response = await patchStatus("approved");
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error, "Invalid verification status");
  assert.equal(state.findCalls, 0);
});

test("verification with missing documents returns the localized missing list", async () => {
  state.driver = {
    ...completeDriver(),
    documents: {
      ...completeDriver().documents,
      nationalIdBack: null,
      carImage: null,
    },
  };

  const response = await patchStatus("verified");
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.error, /required driver details and documents/);
  assert.ok(body.errorAr);
  assert.deepEqual(body.missingKeys, ["nationalIdBack", "carImage"]);
  assert.deepEqual(body.missing, ["National ID (Back)", "Car image"]);
  assert.deepEqual(body.missingAr, ["البطاقة الشخصية (الخلفية)", "صورة السيارة"]);
  assert.equal(state.writes.length, 0);
});

test("verification succeeds for a complete profile", async () => {
  const response = await patchStatus("verified");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.driver.verificationStatus, "verified");
  assert.deepEqual(state.writes, [{ verificationStatus: "verified" }]);
});

test("requesting the current status succeeds without a write", async () => {
  state.driver = { _id: driverId, verificationStatus: "verified" };

  const response = await patchStatus("verified");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.driver.verificationStatus, "verified");
  assert.equal(state.findCalls, 1);
  assert.equal(state.writes.length, 0);
});
