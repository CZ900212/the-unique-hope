import { z } from "zod";

export const TOTAL_WEEKS = 20;
export const MAX_NOTE_LENGTH = 2000;
export const MAX_REJECTION_REASON_LENGTH = 500;
export const MAX_MEETING_LINK_LENGTH = 500;
export const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const roleSchema = z.enum(["admin", "teacher", "student"]);
export const lessonStatusSchema = z.enum([
  "pending",
  "taught",
  "teacher_leave",
  "student_leave",
  "sick",
]);
export const visibilitySchema = z.enum(["private", "shared"]);
export const signupStatusSchema = z.enum(["pending", "approved", "rejected", "all"]);
export const passwordSchema = z.string().min(6).max(128);
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,32}$/, "username must be 3-32 chars: a-z 0-9 . _ -");
export const phoneSchema = z
  .string()
  .trim()
  .min(6)
  .max(20)
  .regex(/^[0-9\s+\-()]+$/);
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

export const resetPasswordSchema = z
  .object({
    token: z.string().trim().min(20).max(255),
    password: passwordSchema,
    confirmPassword: passwordSchema,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "passwords do not match",
    path: ["confirmPassword"],
  });

const deliverableEmailSchema = z
  .string()
  .trim()
  .email()
  .refine((value) => !isManagedLocalEmail(value), {
    message: "email must be a real deliverable address",
  });

export const createPairingSchema = z.object({
  student: z.object({
    name: z.string().trim().min(1).max(120),
    username: usernameSchema,
    email: deliverableEmailSchema,
    password: passwordSchema,
    contact: z.string().trim().max(255).optional().default(""),
  }),
  teacher: z.object({
    name: z.string().trim().min(1).max(120),
    username: usernameSchema,
    email: deliverableEmailSchema,
    password: passwordSchema,
    contact: z.string().trim().max(255).optional().default(""),
  }),
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
  .max(MAX_MEETING_LINK_LENGTH)
  .url("meeting link must be a valid absolute URL")
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  }, "meeting link must use http or https");

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

export const studentSignupSchema = z.object({
  childName: z.string().trim().min(1).max(120),
  age: z.number().int().min(3).max(18),
  phone: phoneSchema,
  contact: z.string().trim().max(255).optional().default(""),
});

export const signupReviewSchema = z
  .object({
    id: z.string().uuid(),
    action: z.enum(["approve", "reject"]),
    reason: z.string().trim().max(MAX_REJECTION_REASON_LENGTH).optional().default(""),
  })
  .refine((data) => data.action !== "reject" || data.reason.length > 0, {
    message: "reason is required when rejecting",
    path: ["reason"],
  });

export const deletePairingSchema = z.object({
  id: z.string().uuid(),
});

export type Role = z.infer<typeof roleSchema>;
export type LessonStatus = z.infer<typeof lessonStatusSchema>;
export type Visibility = z.infer<typeof visibilitySchema>;

export function normalizeIdentifier(identifierRaw: string) {
  return identifierRaw.trim().toLowerCase();
}

export function isEmailIdentifier(value: string) {
  return value.includes("@");
}

export function toCanonicalEmail(email: string | undefined, username: string, role: Role) {
  if (email?.trim()) {
    return email.trim().toLowerCase();
  }

  return `${username}.${role}@theuniquehope.local`;
}

export function isManagedLocalEmail(email: string) {
  return email.trim().toLowerCase().endsWith("@theuniquehope.local");
}

export function inferFileExtension(mime: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return null;
}
