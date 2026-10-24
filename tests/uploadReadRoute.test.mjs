import test, { beforeEach } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

const stateKey = "commuter.upload-read-route-test";
const state = {
  session: { userId: "owner" },
  isAdmin: false,
  adminAuthCalls: 0,
  connectCalls: 0,
  driverQueries: [],
  sensitiveDriver: null,
  file: null,
  downloadCalls: 0,
  ObjectId: class ObjectId {},
};
globalThis[Symbol.for(stateKey)] = state;

const mockedModules = new Map([
  [
    "mongodb",
    `const state = globalThis[Symbol.for(${JSON.stringify(stateKey)})];
    export const ObjectId = state.ObjectId;
    export class GridFSBucket {
      constructor() {}
      openDownloadStream() {
        state.downloadCalls += 1;
        return { async *[Symbol.asyncIterator]() { yield Buffer.from("file contents"); } };
      }
    }`,
  ],
  [
    "@/lib/auth/session",
    `export async function getSession() {
      return globalThis[Symbol.for(${JSON.stringify(stateKey)})].session;
    }`,
  ],
  [
    "@/lib/db/mongoose",
    `const state = globalThis[Symbol.for(${JSON.stringify(stateKey)})];
    export async function connectDB() {
      state.connectCalls += 1;
      return { connection: { db: {
        collection() {
          return { async findOne() { return state.file; } };
        },
      } } };
    }`,
  ],
  [
    "@/lib/middleware/adminAuth",
    `const state = globalThis[Symbol.for(${JSON.stringify(stateKey)})];
    export async function adminAuth() {
      state.adminAuthCalls += 1;
      return state.isAdmin
        ? { authorized: true, userId: "admin" }
        : { authorized: false, response: Response.json({ error: "Admin access required" }, { status: 403 }) };
    }`,
  ],
  [
    "@/models/Driver",
    `const state = globalThis[Symbol.for(${JSON.stringify(stateKey)})];
    export const Driver = {
      findOne(query) {
        state.driverQueries.push(query);
        return {
          select() { return this; },
          async lean() { return state.sensitiveDriver; },
        };
      },
    };`,
  ],
  [
    "@/lib/uploads",
    `export const ALLOWED_UPLOAD_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".pdf"];
    export const UPLOAD_CONTENT_TYPES = {
      ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
      ".webp": "image/webp", ".heic": "image/heic", ".heif": "image/heif",
      ".pdf": "application/pdf",
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

const { GET } = await import("../src/app/api/upload/[filename]/route.ts");

const sensitivePath = "/api/upload/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg";

function resetState() {
  state.session = { userId: "owner" };
  state.isAdmin = false;
  state.adminAuthCalls = 0;
  state.connectCalls = 0;
  state.driverQueries = [];
  state.sensitiveDriver = null;
  state.file = {
    _id: new state.ObjectId(),
    length: 14,
    metadata: { contentType: "text/html" },
  };
  state.downloadCalls = 0;
}

beforeEach(resetState);

async function getFile(filename) {
  const request = new Request(`http://localhost/api/upload/${filename}`);
  return GET(request, { params: Promise.resolve({ filename }) });
}

test("no session is rejected before database access", async () => {
  state.session = null;

  const response = await getFile("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg");

  assert.equal(response.status, 401);
  assert.equal(state.connectCalls, 0);
});

test("a different non-admin user cannot read a sensitive document", async () => {
  state.session = { userId: "other-user" };
  state.sensitiveDriver = { userId: "owner" };

  const response = await getFile(sensitivePath.split("/").at(-1));

  assert.equal(response.status, 403);
  assert.equal(state.adminAuthCalls, 1);
  assert.equal(state.driverQueries[0].$or.length, 6);
  assert.equal(state.downloadCalls, 0);
});

test("the owning driver can read a sensitive document", async () => {
  state.sensitiveDriver = { userId: "owner" };

  const response = await getFile(sensitivePath.split("/").at(-1));

  assert.equal(response.status, 200);
  assert.equal(state.adminAuthCalls, 1);
});

test("an admin can read a sensitive document", async () => {
  state.session = { userId: "admin" };
  state.isAdmin = true;
  state.sensitiveDriver = { userId: "owner" };

  const response = await getFile(sensitivePath.split("/").at(-1));

  assert.equal(response.status, 200);
  assert.equal(state.adminAuthCalls, 1);
});

test("any signed-in user can read a profile picture and stored MIME is ignored", async () => {
  state.session = { userId: "passenger" };

  const response = await getFile("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.jpg");

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Type"), "image/jpeg");
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(response.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(state.adminAuthCalls, 0);
});

test("jpeg, heic, and heif extensions are accepted", async () => {
  const contentTypes = new Map([
    [".jpeg", "image/jpeg"],
    [".heic", "image/heic"],
    [".heif", "image/heif"],
  ]);

  for (const [extension, contentType] of contentTypes) {
    const response = await getFile(`cccccccc-cccc-4ccc-8ccc-cccccccccccc${extension}`);
    assert.equal(response.status, 200, extension);
    assert.equal(response.headers.get("Content-Type"), contentType, extension);
  }
});
