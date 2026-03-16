import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  pgEnum,
  pgTableCreator,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { type AdapterAccount } from "@auth/core/adapters";

export const createTable = pgTableCreator((name) => `unique_hope_${name}`);

export const roleEnum = pgEnum("unique_hope_role", ["admin", "teacher", "student"]);
export const lessonStatusEnum = pgEnum("unique_hope_lesson_status", [
  "pending",
  "taught",
  "teacher_leave",
  "student_leave",
  "sick",
]);
export const visibilityEnum = pgEnum("unique_hope_visibility", ["private", "shared"]);
export const signupStatusEnum = pgEnum("unique_hope_signup_status", [
  "pending",
  "approved",
  "rejected",
]);

export const users = createTable(
  "user",
  {
    id: varchar("id", { length: 255 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    name: varchar("name", { length: 255 }),
    email: varchar("email", { length: 255 }).notNull(),
    emailVerified: timestamp("email_verified", {
      mode: "date",
      withTimezone: true,
    }).defaultNow(),
    image: varchar("image", { length: 255 }),
    authVersion: integer("auth_version").default(1).notNull(),
  },
  (table) => [uniqueIndex("user_email_idx").on(table.email)],
);

export const accounts = createTable(
  "account",
  {
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 255 }).$type<AdapterAccount["type"]>().notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
    index("account_user_id_idx").on(table.userId),
  ],
);

export const sessions = createTable(
  "session",
  {
    sessionToken: varchar("session_token", { length: 255 }).notNull().primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const verificationTokens = createTable(
  "verification_token",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", { mode: "date", withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
);

export const profiles = createTable(
  "profile",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    username: varchar("username", { length: 32 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    contact: varchar("contact", { length: 255 }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("profile_user_id_idx").on(table.userId),
    uniqueIndex("profile_username_idx").on(table.username),
    index("profile_role_idx").on(table.role),
  ],
);

export const userCredentials = createTable(
  "user_credential",
  {
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
);

export const passwordResetTokens = createTable(
  "password_reset_token",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("password_reset_token_hash_idx").on(table.tokenHash),
    index("password_reset_user_id_idx").on(table.userId),
    index("password_reset_expires_at_idx").on(table.expiresAt),
  ],
);

export const studentSignups = createTable(
  "student_signup",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    childName: varchar("child_name", { length: 120 }).notNull(),
    age: integer("age").notNull(),
    phone: varchar("phone", { length: 20 }).notNull(),
    contact: varchar("contact", { length: 255 }),
    status: signupStatusEnum("status").default("pending").notNull(),
    rejectReason: varchar("reject_reason", { length: 500 }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    reviewedAt: timestamp("reviewed_at", { mode: "date", withTimezone: true }),
  },
  (table) => [index("signup_status_idx").on(table.status, table.createdAt)],
);

export const requestRateLimits = createTable(
  "request_rate_limit",
  {
    key: varchar("key", { length: 255 }).notNull().primaryKey(),
    action: varchar("action", { length: 64 }).notNull(),
    subjectHash: varchar("subject_hash", { length: 64 }).notNull(),
    count: integer("count").default(1).notNull(),
    bucketStart: timestamp("bucket_start", { mode: "date", withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { mode: "date", withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("request_rate_limit_action_idx").on(table.action),
    index("request_rate_limit_subject_idx").on(table.subjectHash),
    index("request_rate_limit_expires_idx").on(table.expiresAt),
  ],
);

export const pairings = createTable(
  "pairing",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    teacherProfileId: uuid("teacher_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    meetingLink: varchar("meeting_link", { length: 500 }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("pairing_teacher_idx").on(table.teacherProfileId),
    uniqueIndex("pairing_student_idx").on(table.studentProfileId),
    index("pairing_created_at_idx").on(table.createdAt),
  ],
);

export const lessons = createTable(
  "lesson",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pairingId: uuid("pairing_id")
      .notNull()
      .references(() => pairings.id, { onDelete: "cascade" }),
    weekNumber: integer("week_number").notNull(),
    status: lessonStatusEnum("status").default("pending").notNull(),
    evidenceKey: text("evidence_key"),
    evidenceUrl: text("evidence_url"),
    evidenceMime: varchar("evidence_mime", { length: 100 }),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("lesson_pairing_week_idx").on(table.pairingId, table.weekNumber),
    index("lesson_pairing_idx").on(table.pairingId),
  ],
);

export const lessonNotes = createTable(
  "lesson_note",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    lessonId: uuid("lesson_id")
      .notNull()
      .references(() => lessons.id, { onDelete: "cascade" }),
    text: text("text").notNull().default(""),
    visibility: visibilityEnum("visibility").default("shared").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("lesson_note_lesson_idx").on(table.lessonId)],
);

export const feedback = createTable(
  "feedback",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pairingId: uuid("pairing_id")
      .notNull()
      .references(() => pairings.id, { onDelete: "cascade" }),
    studentProfileId: uuid("student_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    weekNumber: integer("week_number").notNull(),
    text: text("text").notNull(),
    rating: integer("rating"),
    visibility: visibilityEnum("visibility").default("private").notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("feedback_pairing_student_week_idx").on(
      table.pairingId,
      table.studentProfileId,
      table.weekNumber,
    ),
    index("feedback_pairing_idx").on(table.pairingId, table.weekNumber),
  ],
);

export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  passwordResetTokens: many(passwordResetTokens),
  sessions: many(sessions),
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  credential: one(userCredentials, {
    fields: [users.id],
    references: [userCredentials.userId],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
  teacherPairing: one(pairings, {
    fields: [profiles.id],
    references: [pairings.teacherProfileId],
    relationName: "teacherPairing",
  }),
  studentPairing: one(pairings, {
    fields: [profiles.id],
    references: [pairings.studentProfileId],
    relationName: "studentPairing",
  }),
  feedback: many(feedback),
}));

export const userCredentialsRelations = relations(userCredentials, ({ one }) => ({
  user: one(users, {
    fields: [userCredentials.userId],
    references: [users.id],
  }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));

export const pairingsRelations = relations(pairings, ({ one, many }) => ({
  teacher: one(profiles, {
    fields: [pairings.teacherProfileId],
    references: [profiles.id],
    relationName: "teacherPairing",
  }),
  student: one(profiles, {
    fields: [pairings.studentProfileId],
    references: [profiles.id],
    relationName: "studentPairing",
  }),
  lessons: many(lessons),
  feedback: many(feedback),
}));

export const lessonsRelations = relations(lessons, ({ one }) => ({
  pairing: one(pairings, {
    fields: [lessons.pairingId],
    references: [pairings.id],
  }),
  notes: one(lessonNotes, {
    fields: [lessons.id],
    references: [lessonNotes.lessonId],
  }),
}));

export const lessonNotesRelations = relations(lessonNotes, ({ one }) => ({
  lesson: one(lessons, {
    fields: [lessonNotes.lessonId],
    references: [lessons.id],
  }),
}));

export const feedbackRelations = relations(feedback, ({ one }) => ({
  pairing: one(pairings, {
    fields: [feedback.pairingId],
    references: [pairings.id],
  }),
  student: one(profiles, {
    fields: [feedback.studentProfileId],
    references: [profiles.id],
  }),
}));

export const nowSql = sql`CURRENT_TIMESTAMP`;
