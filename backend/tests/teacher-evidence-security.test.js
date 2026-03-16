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

function buildTxProxy() {
  return new Proxy(
    {},
    {
      get: (_target, entity) =>
        new Proxy(
          {},
          {
            get: (_target2, id) => ({
              update: (data) => ({ _entity: entity, _id: id, _action: "update", _data: data }),
              link: (data) => ({ _entity: entity, _id: id, _action: "link", _data: data }),
              delete: () => ({ _entity: entity, _id: id, _action: "delete" })
            })
          }
        )
    }
  );
}

function loadAppWithInstantStub(instantStub) {
  process.env.INSTANT_APP_ID = "test-app-id";
  process.env.INSTANT_ADMIN_TOKEN = "test-admin-token";
  process.env.CORS_ORIGIN = "http://localhost:5500";
  process.env.CSRF_TRUSTED_ORIGINS = "http://localhost:5500";

  clearSrcModules();

  const instantModulePath = require.resolve("../src/lib/instant");
  require.cache[instantModulePath] = {
    id: instantModulePath,
    filename: instantModulePath,
    loaded: true,
    exports: instantStub
  };

  return require("../src/app").app;
}

function createTeacherEvidenceStub() {
  let uploadCalls = 0;

  return {
    uploadCalls: () => uploadCalls,
    instant: {
      db: {
        auth: {
          verifyToken: async () => ({ id: "auth-teacher-id", email: "teacher@example.com" })
        },
        query: async (shape) => {
          if (shape.profiles?.$?.where?.["user.id"]) {
            return {
              profiles: [
                {
                  id: "teacher-profile-id",
                  role: "teacher",
                  name: "Teacher",
                  username: "teacher_demo",
                  contact: ""
                }
              ]
            };
          }

          if (shape.pairings?.$?.where?.["teacher.id"]) {
            return { pairings: [{ id: "pairing-1", student: [{ id: "student-1" }] }] };
          }

          if (shape.lessons?.$?.where?.["pairing.id"]) {
            return { lessons: [] };
          }

          if (shape.lessons?.$?.where?.id) {
            return {
              lessons: [
                {
                  id: shape.lessons.$.where.id,
                  weekNumber: 1,
                  status: "pending",
                  evidencePath: "pairing-1/week-1/file.png",
                  updatedAt: Date.now(),
                  notes: []
                }
              ]
            };
          }

          return {};
        },
        transact: async () => undefined,
        storage: {
          uploadFile: async () => {
            uploadCalls += 1;
          },
          delete: async () => undefined,
          getDownloadUrl: async () => "https://files.example/download"
        }
      },
      id: () => "generated-id",
      tx: buildTxProxy()
    }
  };
}

function teacherHeaders() {
  return {
    Authorization: "Bearer teacher-token",
    Cookie: "uh_csrf_token=test-csrf",
    "X-CSRF-Token": "test-csrf"
  };
}

const validPngBuffer = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/w8AAgMBgJt4tS4AAAAASUVORK5CYII=",
  "base64"
);

test("teacher evidence upload accepts valid PNG signature", async () => {
  const stub = createTeacherEvidenceStub();
  const app = loadAppWithInstantStub(stub.instant);

  await request(app)
    .post("/api/teacher/me/lessons/1/evidence")
    .set(teacherHeaders())
    .attach("file", validPngBuffer, {
      filename: "proof.png",
      contentType: "image/png"
    })
    .expect(201);

  assert.equal(stub.uploadCalls(), 1);
});

test("teacher evidence upload rejects spoofed MIME with bad signature", async () => {
  const stub = createTeacherEvidenceStub();
  const app = loadAppWithInstantStub(stub.instant);

  const response = await request(app)
    .post("/api/teacher/me/lessons/1/evidence")
    .set(teacherHeaders())
    .attach("file", Buffer.from("not-a-real-image"), {
      filename: "proof.png",
      contentType: "image/png"
    })
    .expect(400);

  assert.equal(response.body?.error?.code, "BAD_FILE_SIGNATURE");
  assert.equal(stub.uploadCalls(), 0);
});
