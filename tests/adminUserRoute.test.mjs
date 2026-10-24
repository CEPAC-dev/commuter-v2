import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const stateKey = "commuter.admin.user-route-test";
const state = {
  authorized: true,
  writes: [],
};
globalThis[Symbol.for(stateKey)] = state;

const mockedModules = new Map([
  [
    "@/lib/middleware/adminAuth",
    `export async function adminAuth() {
      const state = globalThis[Symbol.for(${JSON.stringify(stateKey)})];
      return state.authorized
        ? { authorized: true, userId: "admin" }
        : { authorized: false, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
    }`,
  ],
  [
    "@/lib/db/mongoose",
    `export async function connectDB() {}`,
  ],
  [
    "@/lib/security/request",
    `export function validateMutationRequest() { return null; }`,
  ],
  [
    "@/lib/config/regions",
    `export function isRegionCode(value) { return ["EG-CAIRO", "EG-ALEX"].includes(value); }`,
  ],
  [
    "@/models/User",
    `const state = globalThis[Symbol.for(${JSON.stringify(stateKey)})];
    export const User = {
      findByIdAndUpdate(_id, updates) {
        state.writes.push(updates);
        return {
          select() { return this; },
          async lean() { return { _id, ...updates }; },
        };
      },
    };`,
  ],
  ["@/models/Driver", "export const Driver = {};"],
  ["@/models/Availability", "export const Availability = {};"],
  ["@/models/Ride", "export const Ride = {};"],
  ["@/models/Wallet", "export const Wallet = {};"],
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

const { PATCH } = await import("../src/app/api/admin/users/[id]/route.ts");

const userId = "507f1f77bcf86cd799439011";

function resetState() {
  state.authorized = true;
  state.writes = [];
}

beforeEach(resetState);

async function patchUser(body) {
  const request = new Request(`http://localhost/api/admin/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return PATCH(request, { params: Promise.resolve({ id: userId }) });
}

test("role changes are rejected without writing", async () => {
  const response = await patchUser({ role: "admin" });
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.error, /Role changes are not allowed/);
  assert.ok(body.errorAr);
  assert.equal(state.writes.length, 0);
});

test("region-only updates still succeed", async () => {
  const response = await patchUser({ defaultRegionCode: "EG-CAIRO" });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.data.defaultRegionCode, "EG-CAIRO");
  assert.deepEqual(state.writes, [{ defaultRegionCode: "EG-CAIRO" }]);
});

test("non-admin requests are rejected before the update", async () => {
  state.authorized = false;

  const response = await patchUser({ defaultRegionCode: "EG-CAIRO" });

  assert.equal(response.status, 401);
  assert.equal(state.writes.length, 0);
});
