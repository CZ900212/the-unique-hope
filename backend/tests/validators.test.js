const test = require("node:test");
const assert = require("node:assert/strict");
const {
  parseWeek,
  validateBody,
  loginSchema,
  feedbackUpsertSchema
} = require("../src/utils/validators");

test("parseWeek accepts values between 1 and 20", () => {
  assert.equal(parseWeek("1"), 1);
  assert.equal(parseWeek(20), 20);
});

test("parseWeek rejects out-of-range values", () => {
  assert.throws(() => parseWeek("0"));
  assert.throws(() => parseWeek("21"));
});

test("login schema validates role/identifier/password", () => {
  const body = validateBody(loginSchema, {
    identifier: "teacher_user",
    password: "abc12345",
    role: "teacher"
  });
  assert.equal(body.role, "teacher");
  assert.equal(body.identifier, "teacher_user");
});

test("feedback schema defaults visibility and rating", () => {
  const body = validateBody(feedbackUpsertSchema, { text: "Great lesson" });
  assert.equal(body.visibility, "private");
  assert.equal(body.rating, null);
});
