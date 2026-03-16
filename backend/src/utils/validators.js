const { z } = require("zod");
const { HttpError } = require("./httpError");
const { TOTAL_WEEKS } = require("../constants/lesson");

const roleSchema = z.enum(["admin", "teacher", "student"]);
const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, "username must be 3-32 chars: a-z 0-9 . _ -");
const lessonStatusSchema = z.enum([
  "pending",
  "taught",
  "teacher_leave",
  "student_leave",
  "sick"
]);
const visibilitySchema = z.enum(["private", "shared"]);

const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(120),
  password: z.string().min(6).max(128),
  role: roleSchema
});

const createPairingSchema = z.object({
  student: z.object({
    name: z.string().trim().min(1).max(120),
    username: usernameSchema,
    email: z.email().optional(),
    password: z.string().min(6).max(128),
    contact: z.string().trim().max(255).optional().default("")
  }),
  teacher: z.object({
    name: z.string().trim().min(1).max(120),
    username: usernameSchema,
    email: z.email().optional(),
    password: z.string().min(6).max(128)
  })
});

const lessonUpdateSchema = z.object({
  status: lessonStatusSchema,
  notesText: z.string().trim().max(2000).default(""),
  notesVisibility: visibilitySchema.default("shared")
});

const feedbackUpsertSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  rating: z.number().int().min(1).max(5).nullable().optional().default(null),
  visibility: visibilitySchema.default("private")
});

const idParamSchema = z.object({
  id: z.uuid()
});

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20)
});

const cleanupUsersSchema = z.object({
  userIds: z.array(z.uuid()).min(1).max(20)
});

const studentSignupSchema = z.object({
  childName: z.string().trim().min(1).max(120),
  age: z.number().int().min(3).max(18),
  phone: z.string().trim().min(6).max(20).regex(/^[0-9\s+\-()]+$/),
  contact: z.string().trim().max(255).optional().default("")
});

const signupListQuerySchema = paginationSchema.extend({
  status: z.enum(["pending", "approved", "rejected", "all"]).default("all")
});

const signupReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reason: z.string().trim().max(500).optional().default("")
}).refine(
  d => d.action !== "reject" || d.reason.length > 0,
  { message: "reason is required when rejecting", path: ["reason"] }
);

function parseWeek(weekRaw) {
  const parsed = Number(weekRaw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > TOTAL_WEEKS) {
    throw new HttpError(
      400,
      `week must be an integer between 1 and ${TOTAL_WEEKS}`,
      "BAD_WEEK"
    );
  }
  return parsed;
}

function validateBody(schema, payload) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new HttpError(400, "Invalid request payload", "BAD_REQUEST", parsed.error.issues);
  }
  return parsed.data;
}

function validateParams(schema, payload) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new HttpError(400, "Invalid request params", "BAD_PARAMS", parsed.error.issues);
  }
  return parsed.data;
}

function validateQuery(schema, payload) {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new HttpError(400, "Invalid query parameters", "BAD_REQUEST", parsed.error.issues);
  }
  return parsed.data;
}

module.exports = {
  roleSchema,
  usernameSchema,
  lessonStatusSchema,
  visibilitySchema,
  loginSchema,
  createPairingSchema,
  lessonUpdateSchema,
  feedbackUpsertSchema,
  idParamSchema,
  paginationSchema,
  cleanupUsersSchema,
  studentSignupSchema,
  signupListQuerySchema,
  signupReviewSchema,
  parseWeek,
  validateBody,
  validateParams,
  validateQuery
};
