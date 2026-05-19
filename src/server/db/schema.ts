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

export const roleEnum = pgEnum("unique_hope_role", [
  "admin",
  "teacher",
  "student",
]);
export const lessonStatusEnum = pgEnum("unique_hope_lesson_status", [
  "pending",
  "taught",
  "teacher_leave",
  "student_leave",
  "sick",
]);
export const visibilityEnum = pgEnum("unique_hope_visibility", [
  "private",
  "shared",
]);
export const appointmentStatusEnum = pgEnum("unique_hope_appointment_status", [
  "pending",
  "confirmed",
  "declined",
  "cancellation_pending",
  "cancelled",
]);
export const appointmentRequestedByEnum = pgEnum(
  "unique_hope_appointment_requested_by",
  ["student", "teacher"],
);
export const signupStatusEnum = pgEnum("unique_hope_signup_status", [
  "pending",
  "approved",
  "rejected",
]);
export const profileMatchStatusEnum = pgEnum(
  "unique_hope_profile_match_status",
  ["pending", "matched"],
);
export const notificationPushDeliveryStatusEnum = pgEnum(
  "unique_hope_notification_push_delivery_status",
  ["queued", "processing", "sent", "failed", "dead"],
);
export const recoveryPhoneStatusEnum = pgEnum(
  "unique_hope_recovery_phone_status",
  ["active", "disabled"],
);
export const recoveryPhoneSourceEnum = pgEnum(
  "unique_hope_recovery_phone_source",
  ["student_signup_backfill", "admin", "user_verified"],
);
export const smsVerificationPurposeEnum = pgEnum(
  "unique_hope_sms_verification_purpose",
  ["password_reset"],
);
export const recoveryRequestStatusEnum = pgEnum(
  "unique_hope_recovery_request_status",
  ["pending", "approved", "rejected", "expired", "completed"],
);

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
    type: varchar("type", { length: 255 })
      .$type<AdapterAccount["type"]>()
      .notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("provider_account_id", {
      length: 255,
    }).notNull(),
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
    sessionToken: varchar("session_token", { length: 255 })
      .notNull()
      .primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const verificationTokens = createTable(
  "verification_token",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
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
    matchStatus: profileMatchStatusEnum("match_status")
      .default("pending")
      .notNull(),
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

export const userCredentials = createTable("user_credential", {
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
});

export const passwordResetTokens = createTable(
  "password_reset_token",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
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

export const studentRecoveryPhones = createTable(
  "student_recovery_phone",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: varchar("user_id", { length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    phoneHash: varchar("phone_hash", { length: 64 }).notNull(),
    phoneMasked: varchar("phone_masked", { length: 32 }).notNull(),
    phoneLast4: varchar("phone_last4", { length: 8 }).notNull(),
    status: recoveryPhoneStatusEnum("status").default("active").notNull(),
    source: recoveryPhoneSourceEnum("source")
      .default("student_signup_backfill")
      .notNull(),
    verifiedAt: timestamp("verified_at", {
      mode: "date",
      withTimezone: true,
    }),
    lastVerifiedAt: timestamp("last_verified_at", {
      mode: "date",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("student_recovery_phone_hash_idx").on(table.phoneHash),
    index("student_recovery_phone_user_idx").on(table.userId),
    index("student_recovery_phone_status_idx").on(table.status),
  ],
);

export const smsVerificationCodes = createTable(
  "sms_verification_code",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phoneHash: varchar("phone_hash", { length: 64 }).notNull(),
    purpose: smsVerificationPurposeEnum("purpose")
      .default("password_reset")
      .notNull(),
    codeHash: varchar("code_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    maxAttempts: integer("max_attempts").default(5).notNull(),
    consumedAt: timestamp("consumed_at", {
      mode: "date",
      withTimezone: true,
    }),
    sentAt: timestamp("sent_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    provider: varchar("provider", { length: 64 }).notNull(),
    providerMessageId: varchar("provider_message_id", { length: 255 }),
    requestIpHash: varchar("request_ip_hash", { length: 64 }),
    requestUserAgentHash: varchar("request_user_agent_hash", { length: 64 }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("sms_verification_phone_purpose_idx").on(
      table.phoneHash,
      table.purpose,
      table.createdAt,
    ),
    index("sms_verification_expires_idx").on(table.expiresAt),
  ],
);

export const passwordResetSessions = createTable(
  "password_reset_session",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    userId: varchar("user_id", { length: 255 }).references(() => users.id, {
      onDelete: "cascade",
    }),
    phoneHash: varchar("phone_hash", { length: 64 }).notNull(),
    smsCodeId: uuid("sms_code_id")
      .notNull()
      .references(() => smsVerificationCodes.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    consumedAt: timestamp("consumed_at", {
      mode: "date",
      withTimezone: true,
    }),
    attemptCount: integer("attempt_count").default(0).notNull(),
    createdIpHash: varchar("created_ip_hash", { length: 64 }),
    createdUserAgentHash: varchar("created_user_agent_hash", { length: 64 }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("password_reset_session_token_idx").on(table.tokenHash),
    index("password_reset_session_user_idx").on(table.userId),
    index("password_reset_session_phone_idx").on(table.phoneHash),
    index("password_reset_session_expires_idx").on(table.expiresAt),
  ],
);

export const adminRecoveryRequests = createTable(
  "admin_recovery_request",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    phoneHash: varchar("phone_hash", { length: 64 }).notNull(),
    phoneMasked: varchar("phone_masked", { length: 32 }).notNull(),
    candidateCount: integer("candidate_count").notNull(),
    applicantStudentName: varchar("applicant_student_name", {
      length: 120,
    }).notNull(),
    applicantStudentAge: integer("applicant_student_age"),
    applicantNote: text("applicant_note").default("").notNull(),
    status: recoveryRequestStatusEnum("status").default("pending").notNull(),
    reviewedByAdminId: varchar("reviewed_by_admin_id", {
      length: 255,
    }).references(() => users.id, { onDelete: "set null" }),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    reviewedAt: timestamp("reviewed_at", {
      mode: "date",
      withTimezone: true,
    }),
    completedAt: timestamp("completed_at", {
      mode: "date",
      withTimezone: true,
    }),
  },
  (table) => [
    index("admin_recovery_request_phone_status_idx").on(
      table.phoneHash,
      table.status,
    ),
    index("admin_recovery_request_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
  ],
);

export const manualRecoveryRequests = createTable(
  "manual_recovery_request",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    applicantRole: roleEnum("applicant_role").notNull(),
    applicantName: varchar("applicant_name", { length: 120 }).notNull(),
    applicantContact: varchar("applicant_contact", { length: 255 }).notNull(),
    applicantNote: text("applicant_note").default("").notNull(),
    status: recoveryRequestStatusEnum("status").default("pending").notNull(),
    reviewedByAdminId: varchar("reviewed_by_admin_id", {
      length: 255,
    }).references(() => users.id, { onDelete: "set null" }),
    selectedUserId: varchar("selected_user_id", { length: 255 }).references(
      () => users.id,
      { onDelete: "set null" },
    ),
    passwordResetTokenId: uuid("password_reset_token_id").references(
      () => passwordResetTokens.id,
      { onDelete: "set null" },
    ),
    reviewNote: text("review_note"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    reviewedAt: timestamp("reviewed_at", {
      mode: "date",
      withTimezone: true,
    }),
    completedAt: timestamp("completed_at", {
      mode: "date",
      withTimezone: true,
    }),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("manual_recovery_request_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
    index("manual_recovery_request_applicant_lookup_idx").on(
      table.applicantRole,
      table.status,
      table.applicantName,
      table.applicantContact,
    ),
    index("manual_recovery_request_selected_user_idx").on(table.selectedUserId),
    index("manual_recovery_request_token_idx").on(table.passwordResetTokenId),
  ],
);

export const studentSignups = createTable(
  "student_signup",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
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
  (table) => [
    uniqueIndex("student_signup_profile_idx").on(table.profileId),
    index("signup_status_idx").on(table.status, table.createdAt),
  ],
);

export const teacherSignups = createTable(
  "teacher_signup",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    gender: varchar("gender", { length: 16 }).notNull(),
    school: varchar("school", { length: 255 }).notNull(),
    grade: varchar("grade", { length: 64 }).notNull(),
    englishScore: text("english_score").notNull(),
    status: signupStatusEnum("status").default("pending").notNull(),
    rejectReason: varchar("reject_reason", { length: 500 }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    reviewedAt: timestamp("reviewed_at", { mode: "date", withTimezone: true }),
  },
  (table) => [
    uniqueIndex("teacher_signup_profile_idx").on(table.profileId),
    index("teacher_signup_created_at_idx").on(table.createdAt),
    index("teacher_signup_status_idx").on(table.status, table.createdAt),
  ],
);

export const studentInquiries = createTable(
  "student_inquiry",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceSerial: varchar("source_serial", { length: 128 }).notNull(),
    sourceSubmittedAt: timestamp("source_submitted_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    sourceIpHash: varchar("source_ip_hash", { length: 80 }).notNull(),
    sourceRegion: varchar("source_region", { length: 120 }),
    sourceChannel: varchar("source_channel", { length: 64 }).notNull(),
    studentName: varchar("student_name", { length: 255 }).notNull(),
    gender: varchar("gender", { length: 16 }).notNull(),
    school: varchar("school", { length: 255 }).notNull(),
    grade: varchar("grade", { length: 64 }).notNull(),
    englishScore: text("english_score").notNull(),
    importedAt: timestamp("imported_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("student_inquiry_source_channel_serial_idx").on(
      table.sourceChannel,
      table.sourceSerial,
    ),
    index("student_inquiry_submitted_at_idx").on(table.sourceSubmittedAt),
    index("student_inquiry_student_name_idx").on(table.studentName),
  ],
);

export const requestRateLimits = createTable(
  "request_rate_limit",
  {
    key: varchar("key", { length: 255 }).notNull().primaryKey(),
    action: varchar("action", { length: 64 }).notNull(),
    subjectHash: varchar("subject_hash", { length: 64 }).notNull(),
    count: integer("count").default(1).notNull(),
    bucketStart: timestamp("bucket_start", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    expiresAt: timestamp("expires_at", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
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
    uniqueIndex("lesson_pairing_week_idx").on(
      table.pairingId,
      table.weekNumber,
    ),
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

export const lessonAppointments = createTable(
  "lesson_appointment",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    pairingId: uuid("pairing_id")
      .notNull()
      .references(() => pairings.id, { onDelete: "cascade" }),
    weekNumber: integer("week_number"),
    scheduledStart: timestamp("scheduled_start", {
      mode: "date",
      withTimezone: true,
    }).notNull(),
    durationMinutes: integer("duration_minutes").default(45).notNull(),
    status: appointmentStatusEnum("status").default("pending").notNull(),
    requestedBy: appointmentRequestedByEnum("requested_by").notNull(),
    cancellationRequestedBy: appointmentRequestedByEnum(
      "cancellation_requested_by",
    ),
    responseReason: text("response_reason"),
    cancellationReason: text("cancellation_reason"),
    cancellationResponseReason: text("cancellation_response_reason"),
    respondedAt: timestamp("responded_at", {
      mode: "date",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("lesson_appointment_pairing_idx").on(table.pairingId),
    index("lesson_appointment_status_idx").on(table.status, table.updatedAt),
    index("lesson_appointment_schedule_idx").on(
      table.pairingId,
      table.scheduledStart,
    ),
  ],
);

export const userNotifications = createTable(
  "user_notification",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientProfileId: uuid("recipient_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    actorProfileId: uuid("actor_profile_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    appointmentId: uuid("appointment_id").references(
      () => lessonAppointments.id,
      { onDelete: "set null" },
    ),
    type: varchar("type", { length: 64 }).notNull(),
    titleEn: varchar("title_en", { length: 255 }).notNull(),
    titleZh: varchar("title_zh", { length: 255 }).notNull(),
    bodyEn: text("body_en").notNull(),
    bodyZh: text("body_zh").notNull(),
    href: varchar("href", { length: 500 }),
    readAt: timestamp("read_at", { mode: "date", withTimezone: true }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("user_notification_recipient_idx").on(
      table.recipientProfileId,
      table.createdAt,
    ),
    index("user_notification_unread_idx").on(
      table.recipientProfileId,
      table.readAt,
    ),
  ],
);

export const browserPushSubscriptions = createTable(
  "browser_push_subscription",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: varchar("user_agent", { length: 500 }),
    disabledAt: timestamp("disabled_at", {
      mode: "date",
      withTimezone: true,
    }),
    failureCount: integer("failure_count").default(0).notNull(),
    lastSuccessAt: timestamp("last_success_at", {
      mode: "date",
      withTimezone: true,
    }),
    lastErrorAt: timestamp("last_error_at", {
      mode: "date",
      withTimezone: true,
    }),
    expirationTime: timestamp("expiration_time", {
      mode: "date",
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("browser_push_subscription_endpoint_idx").on(table.endpoint),
    index("browser_push_subscription_profile_idx").on(table.profileId),
  ],
);

export const notificationPushDeliveries = createTable(
  "notification_push_delivery",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userNotificationId: uuid("user_notification_id")
      .notNull()
      .references(() => userNotifications.id, { onDelete: "cascade" }),
    recipientProfileId: uuid("recipient_profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    browserPushSubscriptionId: uuid("browser_push_subscription_id")
      .notNull()
      .references(() => browserPushSubscriptions.id, { onDelete: "cascade" }),
    status: notificationPushDeliveryStatusEnum("status")
      .default("queued")
      .notNull(),
    attempts: integer("attempts").default(0).notNull(),
    nextAttemptAt: timestamp("next_attempt_at", {
      mode: "date",
      withTimezone: true,
    })
      .defaultNow()
      .notNull(),
    lastAttemptAt: timestamp("last_attempt_at", {
      mode: "date",
      withTimezone: true,
    }),
    sentAt: timestamp("sent_at", { mode: "date", withTimezone: true }),
    lastStatusCode: integer("last_status_code"),
    lastErrorCode: varchar("last_error_code", { length: 64 }),
    lastErrorMessage: text("last_error_message"),
    createdAt: timestamp("created_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { mode: "date", withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("notification_push_delivery_notification_subscription_idx").on(
      table.userNotificationId,
      table.browserPushSubscriptionId,
    ),
    index("notification_push_delivery_status_next_idx").on(
      table.status,
      table.nextAttemptAt,
    ),
    index("notification_push_delivery_recipient_idx").on(
      table.recipientProfileId,
      table.createdAt,
    ),
    index("notification_push_delivery_subscription_idx").on(
      table.browserPushSubscriptionId,
    ),
  ],
);

export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  adminRecoveryReviews: many(adminRecoveryRequests),
  passwordResetTokens: many(passwordResetTokens),
  passwordResetSessions: many(passwordResetSessions),
  recoveryPhones: many(studentRecoveryPhones),
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
  studentSignup: one(studentSignups, {
    fields: [profiles.id],
    references: [studentSignups.profileId],
  }),
  teacherSignup: one(teacherSignups, {
    fields: [profiles.id],
    references: [teacherSignups.profileId],
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
  notifications: many(userNotifications, {
    relationName: "recipientNotifications",
  }),
  browserPushSubscriptions: many(browserPushSubscriptions),
  notificationPushDeliveries: many(notificationPushDeliveries),
}));

export const userCredentialsRelations = relations(
  userCredentials,
  ({ one }) => ({
    user: one(users, {
      fields: [userCredentials.userId],
      references: [users.id],
    }),
  }),
);

export const studentSignupsRelations = relations(studentSignups, ({ one }) => ({
  profile: one(profiles, {
    fields: [studentSignups.profileId],
    references: [profiles.id],
  }),
}));

export const teacherSignupsRelations = relations(teacherSignups, ({ one }) => ({
  profile: one(profiles, {
    fields: [teacherSignups.profileId],
    references: [profiles.id],
  }),
}));

export const passwordResetTokensRelations = relations(
  passwordResetTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordResetTokens.userId],
      references: [users.id],
    }),
  }),
);

export const studentRecoveryPhonesRelations = relations(
  studentRecoveryPhones,
  ({ one }) => ({
    user: one(users, {
      fields: [studentRecoveryPhones.userId],
      references: [users.id],
    }),
  }),
);

export const smsVerificationCodesRelations = relations(
  smsVerificationCodes,
  ({ many }) => ({
    resetSessions: many(passwordResetSessions),
  }),
);

export const passwordResetSessionsRelations = relations(
  passwordResetSessions,
  ({ one }) => ({
    smsCode: one(smsVerificationCodes, {
      fields: [passwordResetSessions.smsCodeId],
      references: [smsVerificationCodes.id],
    }),
    user: one(users, {
      fields: [passwordResetSessions.userId],
      references: [users.id],
    }),
  }),
);

export const adminRecoveryRequestsRelations = relations(
  adminRecoveryRequests,
  ({ one }) => ({
    reviewedByAdmin: one(users, {
      fields: [adminRecoveryRequests.reviewedByAdminId],
      references: [users.id],
    }),
  }),
);

export const manualRecoveryRequestsRelations = relations(
  manualRecoveryRequests,
  ({ one }) => ({
    reviewedByAdmin: one(users, {
      fields: [manualRecoveryRequests.reviewedByAdminId],
      references: [users.id],
      relationName: "manualRecoveryReviewedBy",
    }),
    selectedUser: one(users, {
      fields: [manualRecoveryRequests.selectedUserId],
      references: [users.id],
      relationName: "manualRecoverySelectedUser",
    }),
    passwordResetToken: one(passwordResetTokens, {
      fields: [manualRecoveryRequests.passwordResetTokenId],
      references: [passwordResetTokens.id],
    }),
  }),
);

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
  appointments: many(lessonAppointments),
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

export const lessonAppointmentsRelations = relations(
  lessonAppointments,
  ({ many, one }) => ({
    pairing: one(pairings, {
      fields: [lessonAppointments.pairingId],
      references: [pairings.id],
    }),
    notifications: many(userNotifications),
  }),
);

export const userNotificationsRelations = relations(
  userNotifications,
  ({ many, one }) => ({
    actor: one(profiles, {
      fields: [userNotifications.actorProfileId],
      references: [profiles.id],
      relationName: "actorNotifications",
    }),
    appointment: one(lessonAppointments, {
      fields: [userNotifications.appointmentId],
      references: [lessonAppointments.id],
    }),
    recipient: one(profiles, {
      fields: [userNotifications.recipientProfileId],
      references: [profiles.id],
      relationName: "recipientNotifications",
    }),
    pushDeliveries: many(notificationPushDeliveries),
  }),
);

export const browserPushSubscriptionsRelations = relations(
  browserPushSubscriptions,
  ({ many, one }) => ({
    profile: one(profiles, {
      fields: [browserPushSubscriptions.profileId],
      references: [profiles.id],
    }),
    deliveries: many(notificationPushDeliveries),
  }),
);

export const notificationPushDeliveriesRelations = relations(
  notificationPushDeliveries,
  ({ one }) => ({
    browserPushSubscription: one(browserPushSubscriptions, {
      fields: [notificationPushDeliveries.browserPushSubscriptionId],
      references: [browserPushSubscriptions.id],
    }),
    recipient: one(profiles, {
      fields: [notificationPushDeliveries.recipientProfileId],
      references: [profiles.id],
    }),
    userNotification: one(userNotifications, {
      fields: [notificationPushDeliveries.userNotificationId],
      references: [userNotifications.id],
    }),
  }),
);

export const nowSql = sql`CURRENT_TIMESTAMP`;
