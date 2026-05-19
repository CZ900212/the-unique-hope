import { z } from "zod";

export const TOTAL_WEEKS = 20;
export const MAX_NOTE_LENGTH = 2000;
export const MAX_REJECTION_REASON_LENGTH = 500;
export const MAX_APPOINTMENT_REASON_LENGTH = 500;
export const MAX_MEETING_LINK_LENGTH = 500;
export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 45;
export const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 32;
export const USERNAME_VALIDATION_MESSAGE =
  "username must be 3-32 chars: letters or numbers from any language, plus . _ -";

const USERNAME_ALLOWED_RE = /^[\p{L}\p{N}\p{M}._-]+$/u;
const ASCII_LOCAL_USERNAME_RE = /^[a-z0-9._-]+$/;
const MANAGED_LOCAL_EMAIL_DOMAIN = "theuniquehope.local";
const FNV1A_64_OFFSET = 0xcbf29ce484222325n;
const FNV1A_64_PRIME = 0x100000001b3n;
const FNV1A_64_MASK = 0xffffffffffffffffn;

function countCharacters(value: string) {
  return Array.from(value).length;
}

function hasAllowedUsernameCharacters(value: string) {
  return USERNAME_ALLOWED_RE.test(value);
}

function isUsernameLengthAllowed(value: string) {
  const length = countCharacters(value);
  return length >= USERNAME_MIN_LENGTH && length <= USERNAME_MAX_LENGTH;
}

function isValidNormalizedUsername(value: string) {
  return isUsernameLengthAllowed(value) && hasAllowedUsernameCharacters(value);
}

function hashManagedLocalEmailKey(value: string) {
  let hash = FNV1A_64_OFFSET;

  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV1A_64_PRIME) & FNV1A_64_MASK;
  }

  return hash.toString(36);
}

export const roleSchema = z.enum(["admin", "teacher", "student"]);
export const lessonStatusSchema = z.enum([
  "pending",
  "taught",
  "teacher_leave",
  "student_leave",
  "sick",
]);
export const visibilitySchema = z.enum(["private", "shared"]);
export const appointmentStatusSchema = z.enum([
  "pending",
  "confirmed",
  "declined",
  "cancellation_pending",
  "cancelled",
]);
export const appointmentRequestedBySchema = z.enum(["student", "teacher"]);
export const signupStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "all",
]);
export const profileMatchStatusSchema = z.enum(["pending", "matched"]);
export const passwordSchema = z.string().min(6).max(128);
export const recoveryPasswordSchema = z.string().min(8).max(64);
export const optionalSignupEmailSchema = z
  .union([z.string().trim().email(), z.literal("")])
  .optional()
  .transform((value) =>
    value && value.length > 0 ? normalizeEmailIdentifier(value) : undefined,
  );

export function normalizeEmailIdentifier(identifierRaw: string) {
  return identifierRaw.trim().toLowerCase();
}

export function normalizeUsername(usernameRaw: string) {
  const trimmed = usernameRaw.trim();
  return trimmed.length > 0 ? trimmed.normalize("NFC").toLowerCase() : trimmed;
}

export function isValidUsername(usernameRaw: string) {
  return isValidNormalizedUsername(normalizeUsername(usernameRaw));
}

function createManagedLocalEmailLocalPart(username: string, role: Role) {
  const normalizedUsername = normalizeUsername(username);

  if (ASCII_LOCAL_USERNAME_RE.test(normalizedUsername)) {
    return `${normalizedUsername}.${role}`;
  }

  return `managed-${role}-${hashManagedLocalEmailKey(`${role}:${normalizedUsername}`)}`;
}

export const usernameSchema = z
  .string()
  .transform(normalizeUsername)
  .refine(isValidNormalizedUsername, USERNAME_VALIDATION_MESSAGE);

export const nameSchema = z.string().trim().min(1).max(120);
export const phoneSchema = z
  .string()
  .trim()
  .min(6)
  .max(20)
  .regex(/^[0-9\s+\-()]+$/);
export const shortTextSchema = z.string().trim().min(1).max(255);
export const weekSchema = z.number().int().min(1).max(TOTAL_WEEKS);

export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});

export const listStudentSignupsSchema = paginationSchema.extend({
  status: signupStatusSchema.default("all"),
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(3).max(120),
  password: passwordSchema,
  role: roleSchema,
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().trim().min(3).max(120),
  role: roleSchema,
});

export const emailPasswordResetRequestSchema = z.object({
  recoveryMode: z.literal("email"),
  identifier: z.string().trim().min(3).max(120),
  role: z.enum(["student", "teacher"]),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(20).max(255),
    password: recoveryPasswordSchema,
    confirmPassword: recoveryPasswordSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "passwords do not match",
    path: ["confirmPassword"],
  });

export const phonePasswordResetRequestSchema = z.object({
  phone: phoneSchema,
});

export const manualRecoveryRequestSchema = z.object({
  applicantRole: z.enum(["student", "teacher"]),
  applicantName: nameSchema,
  applicantContact: z.string().trim().min(1).max(255),
  applicantNote: z.string().trim().max(1000).optional().default(""),
});

export const manualPasswordResetRequestSchema =
  manualRecoveryRequestSchema.extend({
    recoveryMode: z.literal("manual").optional(),
  });

export const phonePasswordResetVerifySchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^[0-9]{6}$/),
  phone: phoneSchema,
});

export const phonePasswordResetManualRequestSchema = z.object({
  applicantNote: z.string().trim().max(1000).optional().default(""),
  studentAge: z.number().int().min(3).max(18).nullable().optional(),
  studentName: nameSchema,
  token: z.string().trim().min(20).max(255),
});

export const phonePasswordResetConfirmSchema = z
  .object({
    token: z.string().trim().min(20).max(255),
    password: recoveryPasswordSchema,
    confirmPassword: recoveryPasswordSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "passwords do not match",
    path: ["confirmPassword"],
  });

export const createPairingSchema = z.object({
  studentProfileId: z.string().uuid(),
  teacherProfileId: z.string().uuid(),
});

export const lessonUpdateSchema = z.object({
  week: weekSchema,
  status: lessonStatusSchema,
  notesText: z.string().trim().max(MAX_NOTE_LENGTH).default(""),
  notesVisibility: visibilitySchema.default("shared"),
});

export const meetingLinkSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_MEETING_LINK_LENGTH);

export const updateMeetingLinkSchema = z.object({
  meetingLink: z
    .string()
    .trim()
    .max(MAX_MEETING_LINK_LENGTH)
    .transform((value) => (value.length === 0 ? null : value))
    .pipe(meetingLinkSchema.nullable()),
});

export const feedbackUpsertSchema = z.object({
  week: weekSchema,
  text: z.string().trim().min(1).max(MAX_NOTE_LENGTH),
  rating: z.number().int().min(1).max(5).nullable().optional().default(null),
  visibility: visibilitySchema.default("private"),
});

export const appointmentRequestSchema = z.object({
  id: z.string().uuid().optional(),
  scheduledStart: z.coerce
    .date()
    .refine((date) => date.getTime() > Date.now(), {
      message: "Appointment time must be in the future.",
    }),
  durationMinutes: z
    .number()
    .int()
    .min(15)
    .max(180)
    .default(DEFAULT_APPOINTMENT_DURATION_MINUTES),
});

export const appointmentResponseSchema = z
  .object({
    id: z.string().uuid(),
    action: z.enum(["confirm", "decline", "request_cancel"]),
    reason: z
      .string()
      .trim()
      .max(MAX_APPOINTMENT_REASON_LENGTH)
      .optional()
      .default(""),
  })
  .refine(
    (data) =>
      !["decline", "request_cancel"].includes(data.action) ||
      data.reason.trim().length > 0,
    {
      message: "A reason is required for this appointment response.",
      path: ["reason"],
    },
  );

export const studentSignupSchema = z.object({
  childName: nameSchema,
  age: z.number().int().min(3).max(18),
  phone: phoneSchema,
  contact: z.string().trim().max(255).optional().default(""),
  email: optionalSignupEmailSchema,
  username: usernameSchema,
  password: passwordSchema,
});

export const teacherSignupSchema = z.object({
  name: nameSchema,
  gender: z.string().trim().min(1).max(16),
  school: shortTextSchema,
  grade: z.string().trim().min(1).max(64),
  englishScore: z.string().trim().min(1).max(MAX_NOTE_LENGTH),
  email: optionalSignupEmailSchema,
  username: usernameSchema,
  password: passwordSchema,
});

export const signupReviewSchema = z
  .object({
    id: z.string().uuid(),
    action: z.enum(["approve", "reject"]),
    reason: z
      .string()
      .trim()
      .max(MAX_REJECTION_REASON_LENGTH)
      .optional()
      .default(""),
  })
  .refine((data) => data.action !== "reject" || data.reason.length > 0, {
    message: "reason is required when rejecting",
    path: ["reason"],
  });

export const reviewedSignupsFilterSchema = z.object({
  role: z.enum(["student", "teacher", "all"]).default("all"),
  status: z.enum(["approved", "rejected", "all"]).default("all"),
});

export const deletePairingSchema = z.object({
  id: z.string().uuid(),
});

export type Role = z.infer<typeof roleSchema>;
export type LessonStatus = z.infer<typeof lessonStatusSchema>;
export type Visibility = z.infer<typeof visibilitySchema>;
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;
export type AppointmentRequestedBy = z.infer<
  typeof appointmentRequestedBySchema
>;
export type ProfileMatchStatus = z.infer<typeof profileMatchStatusSchema>;

export function normalizeIdentifier(identifierRaw: string) {
  const trimmed = identifierRaw.trim();
  return isEmailIdentifier(trimmed)
    ? normalizeEmailIdentifier(trimmed)
    : normalizeUsername(trimmed);
}

export function isEmailIdentifier(value: string) {
  return value.includes("@");
}

export function toCanonicalEmail(
  email: string | undefined,
  username: string,
  role: Role,
) {
  if (email?.trim()) {
    return normalizeEmailIdentifier(email);
  }

  return `${createManagedLocalEmailLocalPart(username, role)}@${MANAGED_LOCAL_EMAIL_DOMAIN}`;
}

export function isManagedLocalEmail(email: string) {
  return normalizeEmailIdentifier(email).endsWith(
    `@${MANAGED_LOCAL_EMAIL_DOMAIN}`,
  );
}

export function inferFileExtension(mime: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return null;
}
