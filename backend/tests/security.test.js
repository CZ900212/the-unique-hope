const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const express = require("express");
const request = require("supertest");
const { HttpError } = require("../src/utils/httpError");
const { errorHandler } = require("../src/middleware/error");

function clearSrcModules() {
  for (const modulePath of Object.keys(require.cache)) {
    if (modulePath.includes(`${path.sep}backend${path.sep}src${path.sep}`)) {
      delete require.cache[modulePath];
    }
  }
}

function buildInstantStub() {
  return {
    db: {
      query: async () => ({ profiles: [] }),
      auth: {
        createToken: async () => "test-token",
        verifyToken: async () => null
      }
    },
    id: () => "test-id",
    tx: {}
  };
}

function loadAppWithMocks() {
  process.env.INSTANT_APP_ID = process.env.INSTANT_APP_ID || "test-app-id";
  process.env.INSTANT_ADMIN_TOKEN = process.env.INSTANT_ADMIN_TOKEN || "test-admin-token";
  process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5500";
  process.env.CSRF_TRUSTED_ORIGINS =
    process.env.CSRF_TRUSTED_ORIGINS || "http://localhost:5500";

  clearSrcModules();

  const instantModulePath = require.resolve("../src/lib/instant");
  require.cache[instantModulePath] = {
    id: instantModulePath,
    filename: instantModulePath,
    loaded: true,
    exports: buildInstantStub()
  };

  return require("../src/app").app;
}

test("login endpoint is rate-limited after 10 attempts", async () => {
  const app = loadAppWithMocks();
  const payload = {
    identifier: "teacher_demo",
    password: "abc12345",
    role: "teacher"
  };

  for (let attempt = 0; attempt < 10; attempt += 1) {
    await request(app)
      .post("/api/auth/login")
      .set("Origin", "http://localhost:5500")
      .send(payload)
      .expect(401);
  }

  const response = await request(app)
    .post("/api/auth/login")
    .set("Origin", "http://localhost:5500")
    .send(payload)
    .expect(429);
  assert.equal(response.body?.error?.code, "TOO_MANY_REQUESTS");
});

test("login endpoint rejects untrusted origin for cookie-based login", async () => {
  const app = loadAppWithMocks();
  const response = await request(app)
    .post("/api/auth/login")
    .set("Origin", "https://evil.example")
    .send({ identifier: "teacher_demo", password: "abc12345", role: "teacher" })
    .expect(403);

  assert.equal(response.body?.error?.code, "ORIGIN_INVALID");
});

test("login endpoint allows bearer clients without origin check", async () => {
  const app = loadAppWithMocks();
  const response = await request(app)
    .post("/api/auth/login")
    .set("Authorization", "Bearer test-token")
    .send({ identifier: "teacher_demo", password: "abc12345", role: "teacher" })
    .expect(401);

  assert.equal(response.body?.error?.code, "INVALID_CREDENTIALS");
});

test("helmet security headers are present", async () => {
  const app = loadAppWithMocks();
  const response = await request(app).get("/api/health").expect(200);

  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.equal(response.headers["x-frame-options"], "SAMEORIGIN");
});

test("error details are hidden in production", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";

    const app = express();
    app.get("/boom", (_req, _res, next) => {
      next(new HttpError(400, "Bad request", "BAD_REQUEST", { reason: "internal" }));
    });
    app.use(errorHandler);

    const response = await request(app).get("/boom").expect(400);
    assert.deepEqual(response.body, {
      error: {
        code: "BAD_REQUEST",
        message: "Bad request"
      }
    });
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
  }
});

test("server errors return generic payload without internal message", async () => {
  const app = express();
  app.get("/boom", (_req, _res, next) => {
    next(new Error("sensitive stack context"));
  });
  app.use(errorHandler);

  const response = await request(app).get("/boom").expect(500);
  assert.deepEqual(response.body, {
    error: {
      code: "INTERNAL_ERROR",
      message: "Internal Server Error"
    }
  });
});
