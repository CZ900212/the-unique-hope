const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const request = require("supertest");

function clearSrcModules() {
  for (const modulePath of Object.keys(require.cache)) {
    if (modulePath.includes(`${path.sep}backend${path.sep}src${path.sep}`)) {
      delete require.cache[modulePath];
    }
  }
}

let signupStore = {};
const FAKE_ID = "00000000-0000-4000-8000-000000000001";
const FAKE_ID_2 = "00000000-0000-4000-8000-000000000002";
const MISSING_ID = "00000000-0000-4000-8000-ffffffffffff";

function buildInstantStub() {
  return {
    db: {
      query: async (q) => {
        if (q.studentSignups) {
          const where = q.studentSignups.$?.where;
          let results = Object.values(signupStore);
          if (where?.id) {
            results = results.filter((s) => s.id === where.id);
          }
          if (where?.status) {
            results = results.filter((s) => s.status === where.status);
          }
          return { studentSignups: results };
        }
        if (q.profiles) {
          return {
            profiles: [{
              id: "admin-profile-id",
              role: "admin",
              name: "Admin",
              username: "admin",
              contact: ""
            }]
          };
        }
        return {};
      },
      transact: async (txns) => {
        for (const txn of txns) {
          if (txn._entity === "studentSignups" && txn._data) {
            signupStore[txn._id] = { id: txn._id, ...txn._data };
          }
        }
      },
      auth: {
        verifyToken: async (token) => {
          if (token === "admin-token") return { id: "admin-user-id", email: "admin@test.com" };
          return null;
        },
        createToken: async () => "test-token"
      }
    },
    id: () => "test-signup-" + Date.now(),
    tx: new Proxy({}, {
      get: (_target, entity) => new Proxy({}, {
        get: (_t2, id) => ({
          update: (data) => ({ _entity: entity, _id: id, _data: data }),
          delete: () => ({ _entity: entity, _id: id, _delete: true })
        })
      })
    })
  };
}

function loadAppWithMocks() {
  process.env.INSTANT_APP_ID = process.env.INSTANT_APP_ID || "test-app-id";
  process.env.INSTANT_ADMIN_TOKEN = process.env.INSTANT_ADMIN_TOKEN || "test-admin-token";
  process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5500";

  clearSrcModules();
  signupStore = {};

  const instantModulePath = require.resolve("../src/lib/instant");
  require.cache[instantModulePath] = {
    id: instantModulePath,
    filename: instantModulePath,
    loaded: true,
    exports: buildInstantStub()
  };

  return require("../src/app").app;
}

function adminHeaders() {
  return {
    Cookie: "uh_access_token=admin-token; uh_csrf_token=test-csrf",
    "X-CSRF-Token": "test-csrf"
  };
}

// --- Public signup tests ---

test("public signup: success returns 201 with pending status", async () => {
  const app = loadAppWithMocks();
  const res = await request(app)
    .post("/api/public/student-signups")
    .send({ childName: "小明", age: 8, phone: "13812345678" })
    .expect(201);

  assert.equal(res.body.signup.status, "pending");
  assert.equal(typeof res.body.signup.createdAt, "number");
  assert.ok(res.body.signup.id);
});

test("public signup: missing required field returns 400", async () => {
  const app = loadAppWithMocks();
  const res = await request(app)
    .post("/api/public/student-signups")
    .send({ childName: "小明", age: 8 })
    .expect(400);

  assert.equal(res.body.error.code, "BAD_REQUEST");
});

test("public signup: age out of range (2) returns 400", async () => {
  const app = loadAppWithMocks();
  await request(app)
    .post("/api/public/student-signups")
    .send({ childName: "小明", age: 2, phone: "13812345678" })
    .expect(400);
});

test("public signup: age out of range (19) returns 400", async () => {
  const app = loadAppWithMocks();
  await request(app)
    .post("/api/public/student-signups")
    .send({ childName: "小明", age: 19, phone: "13812345678" })
    .expect(400);
});

test("public signup: invalid phone characters returns 400", async () => {
  const app = loadAppWithMocks();
  await request(app)
    .post("/api/public/student-signups")
    .send({ childName: "小明", age: 8, phone: "abc-invalid" })
    .expect(400);
});

test("public signup: rate limit triggers 429", async () => {
  const app = loadAppWithMocks();
  const payload = { childName: "小明", age: 8, phone: "13812345678" };

  // Send requests until we get rate limited
  let gotRateLimited = false;
  for (let i = 0; i < 10; i++) {
    const res = await request(app).post("/api/public/student-signups").send(payload);
    if (res.status === 429) {
      assert.equal(res.body.error.code, "TOO_MANY_REQUESTS");
      gotRateLimited = true;
      break;
    }
  }

  assert.ok(gotRateLimited, "Expected rate limit to trigger within 10 requests");
});

// --- Admin list tests ---

test("admin list signups: returns 200 with pagination", async () => {
  const app = loadAppWithMocks();
  signupStore[FAKE_ID] = { id: FAKE_ID, childName: "小明", age: 8, phone: "138", contact: "", status: "pending", rejectReason: "", createdAt: Date.now() };

  const res = await request(app)
    .get("/api/admin/student-signups?page=1&pageSize=20")
    .set(adminHeaders())
    .expect(200);

  assert.ok(Array.isArray(res.body.signups));
  assert.ok(res.body.pagination);
  assert.equal(res.body.signups[0].childName, "小明");
});

test("admin list signups: non-admin gets 403", async () => {
  const app = loadAppWithMocks();
  await request(app)
    .get("/api/admin/student-signups")
    .expect(401);
});

// --- Admin review tests ---

test("admin review: approve returns 200 with approved status", async () => {
  const app = loadAppWithMocks();
  signupStore[FAKE_ID] = { id: FAKE_ID, childName: "小明", age: 8, phone: "138", contact: "", status: "pending", rejectReason: "", createdAt: Date.now() };

  const res = await request(app)
    .patch(`/api/admin/student-signups/${FAKE_ID}/review`)
    .set(adminHeaders())
    .send({ action: "approve" })
    .expect(200);

  assert.equal(res.body.signup.status, "approved");
  assert.equal(typeof res.body.signup.reviewedAt, "number");
});

test("admin review: reject without reason returns 400", async () => {
  const app = loadAppWithMocks();
  signupStore[FAKE_ID] = { id: FAKE_ID, childName: "小明", age: 8, phone: "138", contact: "", status: "pending", rejectReason: "", createdAt: Date.now() };

  await request(app)
    .patch(`/api/admin/student-signups/${FAKE_ID}/review`)
    .set(adminHeaders())
    .send({ action: "reject" })
    .expect(400);
});

test("admin review: reject with reason returns 200", async () => {
  const app = loadAppWithMocks();
  signupStore[FAKE_ID] = { id: FAKE_ID, childName: "小明", age: 8, phone: "138", contact: "", status: "pending", rejectReason: "", createdAt: Date.now() };

  const res = await request(app)
    .patch(`/api/admin/student-signups/${FAKE_ID}/review`)
    .set(adminHeaders())
    .send({ action: "reject", reason: "年龄不符" })
    .expect(200);

  assert.equal(res.body.signup.status, "rejected");
  assert.equal(res.body.signup.rejectReason, "年龄不符");
});

test("admin review: non-existent ID returns 404", async () => {
  const app = loadAppWithMocks();

  await request(app)
    .patch(`/api/admin/student-signups/${MISSING_ID}/review`)
    .set(adminHeaders())
    .send({ action: "approve" })
    .expect(404);
});

test("admin review: already approved returns 409", async () => {
  const app = loadAppWithMocks();
  signupStore[FAKE_ID] = { id: FAKE_ID, childName: "小明", age: 8, phone: "138", contact: "", status: "approved", rejectReason: "", createdAt: Date.now(), reviewedAt: Date.now() };

  const res = await request(app)
    .patch(`/api/admin/student-signups/${FAKE_ID}/review`)
    .set(adminHeaders())
    .send({ action: "approve" })
    .expect(409);

  assert.equal(res.body.error.code, "SIGNUP_ALREADY_REVIEWED");
});

test("admin review: already rejected returns 409", async () => {
  const app = loadAppWithMocks();
  signupStore[FAKE_ID] = { id: FAKE_ID, childName: "小明", age: 8, phone: "138", contact: "", status: "rejected", rejectReason: "test", createdAt: Date.now(), reviewedAt: Date.now() };

  const res = await request(app)
    .patch(`/api/admin/student-signups/${FAKE_ID}/review`)
    .set(adminHeaders())
    .send({ action: "reject", reason: "again" })
    .expect(409);

  assert.equal(res.body.error.code, "SIGNUP_ALREADY_REVIEWED");
});

test("admin review: missing CSRF token returns 403", async () => {
  const app = loadAppWithMocks();
  signupStore[FAKE_ID] = { id: FAKE_ID, childName: "小明", age: 8, phone: "138", contact: "", status: "pending", rejectReason: "", createdAt: Date.now() };

  const res = await request(app)
    .patch(`/api/admin/student-signups/${FAKE_ID}/review`)
    .set({ Cookie: "uh_access_token=admin-token" })
    .send({ action: "approve" })
    .expect(403);

  assert.equal(res.body.error.code, "CSRF_TOKEN_INVALID");
});
