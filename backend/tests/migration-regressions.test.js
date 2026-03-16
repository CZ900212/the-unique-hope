const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const bcrypt = require("bcrypt");
const request = require("supertest");

function clearSrcModules() {
  for (const modulePath of Object.keys(require.cache)) {
    if (modulePath.includes(`${path.sep}backend${path.sep}src${path.sep}`)) {
      delete require.cache[modulePath];
    }
  }
}

function loadAppWithInstantStub(instantStub) {
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
    exports: instantStub
  };

  return require("../src/app").app;
}

function buildRoleStub(role) {
  const profile =
    role === "student"
      ? {
          id: "student-profile-id",
          role: "student",
          name: "Demo Student",
          username: "demo_student",
          contact: "student@example.com"
        }
      : {
          id: "teacher-profile-id",
          role: "teacher",
          name: "Demo Teacher",
          username: "demo_teacher",
          contact: "teacher@example.com"
        };

  return {
    db: {
      auth: {
        verifyToken: async () => ({ id: `auth-${role}`, email: `${role}@example.com` }),
        createToken: async () => "token"
      },
      query: async (shape) => {
        if (shape.profiles && shape.profiles.$?.where?.["user.id"]) {
          return { profiles: [profile] };
        }

        if (shape.pairings && shape.pairings.$?.where?.["student.id"]) {
          return {
            pairings: [{ id: "pairing-1", teacher: [{ id: "teacher-profile-id", name: "Demo Teacher" }] }]
          };
        }

        if (shape.pairings && shape.pairings.$?.where?.["teacher.id"]) {
          return {
            pairings: [{ id: "pairing-1", student: [{ id: "student-profile-id", name: "Demo Student" }] }]
          };
        }

        if (shape.lessons && shape.lessons.$?.where?.["pairing.id"]) {
          return {
            lessons: [
              {
                id: "lesson-1",
                weekNumber: 1,
                status: "taught",
                evidencePath: null,
                updatedAt: Date.now(),
                notes: []
              }
            ]
          };
        }

        if (shape.feedback && shape.feedback.$?.where?.["pairing.id"]) {
          return {
            feedback: [
              {
                id: "feedback-1",
                weekNumber: 1,
                text: "Great progress",
                rating: 5,
                visibility: "shared",
                updatedAt: Date.now()
              }
            ]
          };
        }

        return {};
      }
    },
    id: () => "test-id",
    tx: {}
  };
}

test("student dashboard returns 200 with lesson progress", async () => {
  const app = loadAppWithInstantStub(buildRoleStub("student"));

  const response = await request(app)
    .get("/api/student/me/dashboard")
    .set("Authorization", "Bearer test-token")
    .expect(200);

  assert.equal(response.body.student.name, "Demo Student");
  assert.equal(response.body.progress.taughtCount, 1);
  assert.equal(response.body.progress.weeks[0].status, "taught");
});

test("teacher dashboard returns 200 with latest shared feedback", async () => {
  const app = loadAppWithInstantStub(buildRoleStub("teacher"));

  const response = await request(app)
    .get("/api/teacher/me/dashboard")
    .set("Authorization", "Bearer test-token")
    .expect(200);

  assert.equal(response.body.teacher.name, "Demo Teacher");
  assert.equal(response.body.latestSharedFeedback.text, "Great progress");
});

test("login mints token for linked auth email", async () => {
  let issuedEmail = null;
  const password = "abc12345";
  const passwordHash = await bcrypt.hash(password, 6);

  const app = loadAppWithInstantStub({
    db: {
      query: async (shape) => {
        if (shape.profiles) {
          return {
            profiles: [
              {
                id: "teacher-profile-id",
                role: "teacher",
                username: "teacher_demo",
                name: "Teacher Demo",
                passwordHash,
                user: [{ id: "auth-user-id", email: "custom.teacher@example.com" }]
              }
            ]
          };
        }
        return {};
      },
      auth: {
        createToken: async ({ email }) => {
          issuedEmail = email;
          return "test-token";
        },
        verifyToken: async () => ({ id: "auth-user-id", email: "custom.teacher@example.com" })
      }
    },
    id: () => "test-id",
    tx: {}
  });

  await request(app)
    .post("/api/auth/login")
    .set("Origin", "http://localhost:5500")
    .send({ identifier: "teacher_demo", password, role: "teacher" })
    .expect(200);

  assert.equal(issuedEmail, "custom.teacher@example.com");
});
