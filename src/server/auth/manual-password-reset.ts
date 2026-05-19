import { TRPCError } from "@trpc/server";
import { and, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";

import { isManagedLocalEmail, manualRecoveryRequestSchema } from "~/lib/domain";
import { createPasswordResetTokenForUser } from "~/server/auth/password-reset";
import { db } from "~/server/db";
import {
  manualRecoveryRequests,
  profiles,
  studentSignups,
  teacherSignups,
  users,
} from "~/server/db/schema";
import { consumeRateLimit, extractClientIp } from "~/server/rate-limit";

const MANUAL_RESET_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

type ManualApplicantRole = "student" | "teacher";

type ManualRecoveryRequestRow = typeof manualRecoveryRequests.$inferSelect & {
  applicantRole: ManualApplicantRole;
};

type Candidate = {
  contact: string | null;
  email: string | null;
  name: string;
  profileId: string;
  role: ManualApplicantRole;
  score: number;
  student: {
    age: number | null;
    contact: string | null;
    phone: string | null;
    status: string | null;
  } | null;
  teacher: {
    grade: string | null;
    school: string | null;
    status: string | null;
  } | null;
  userId: string;
  username: string;
};

export async function createManualRecoveryRequest(input: {
  applicantContact: string;
  applicantName: string;
  applicantNote?: string;
  applicantRole: ManualApplicantRole;
  request: Request;
}) {
  const parsed = manualRecoveryRequestSchema.parse(input);
  const clientIp = extractClientIp(input.request);

  if (clientIp) {
    const rateLimit = await consumeRateLimit({
      action: "password-reset-manual:ip-hour",
      limit: 3,
      subject: clientIp,
      windowMs: 60 * 60 * 1000,
    });
    if (!rateLimit.allowed) {
      return {
        status: "rate_limited" as const,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      };
    }
  }

  const existing = await db.query.manualRecoveryRequests.findFirst({
    where: and(
      eq(manualRecoveryRequests.applicantRole, parsed.applicantRole),
      eq(manualRecoveryRequests.status, "pending"),
      sql`lower(${manualRecoveryRequests.applicantName}) = ${normalizeForLookup(parsed.applicantName)}`,
      sql`lower(${manualRecoveryRequests.applicantContact}) = ${normalizeForLookup(parsed.applicantContact)}`,
    ),
  });

  if (!existing) {
    await db.insert(manualRecoveryRequests).values({
      applicantRole: parsed.applicantRole,
      applicantName: parsed.applicantName,
      applicantContact: parsed.applicantContact,
      applicantNote: parsed.applicantNote,
    });
  }

  return { status: "queued" as const };
}

export async function listManualRecoveryRequests() {
  const requests = (await db
    .select()
    .from(manualRecoveryRequests)
    .orderBy(desc(manualRecoveryRequests.createdAt))
    .limit(100)) as ManualRecoveryRequestRow[];

  return Promise.all(
    requests.map(async (request) => ({
      ...request,
      candidates: await findManualRecoveryCandidates(request),
    })),
  );
}

export async function rejectManualRecoveryRequest(input: {
  adminUserId: string;
  requestId: string;
}) {
  const now = new Date();
  const [updated] = await db
    .update(manualRecoveryRequests)
    .set({
      reviewedAt: now,
      reviewedByAdminId: input.adminUserId,
      status: "rejected",
      updatedAt: now,
    })
    .where(
      and(
        eq(manualRecoveryRequests.id, input.requestId),
        eq(manualRecoveryRequests.status, "pending"),
      ),
    )
    .returning({ id: manualRecoveryRequests.id });

  if (!updated) {
    throw new TRPCError({ code: "BAD_REQUEST" });
  }
}

export async function createManualRecoveryResetUrl(input: {
  adminUserId: string;
  requestId: string;
  userId: string;
}) {
  const request = (await db.query.manualRecoveryRequests.findFirst({
    where: eq(manualRecoveryRequests.id, input.requestId),
  })) as ManualRecoveryRequestRow | undefined;

  if (!request) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  if (request.status !== "pending") {
    throw new TRPCError({ code: "BAD_REQUEST" });
  }

  const candidates = await findManualRecoveryCandidates(request);
  const selected = candidates.find(
    (candidate) => candidate.userId === input.userId,
  );
  if (!selected) {
    throw new TRPCError({ code: "BAD_REQUEST" });
  }

  const token = await createPasswordResetTokenForUser({
    ttlMs: MANUAL_RESET_TOKEN_TTL_MS,
    userId: input.userId,
  });
  const now = new Date();
  const [updated] = await db
    .update(manualRecoveryRequests)
    .set({
      passwordResetTokenId: token.tokenId,
      reviewedAt: now,
      reviewedByAdminId: input.adminUserId,
      selectedUserId: input.userId,
      status: "approved",
      updatedAt: now,
    })
    .where(
      and(
        eq(manualRecoveryRequests.id, input.requestId),
        eq(manualRecoveryRequests.status, "pending"),
      ),
    )
    .returning({ id: manualRecoveryRequests.id });

  if (!updated) {
    throw new TRPCError({ code: "BAD_REQUEST" });
  }

  return token.resetUrl;
}

async function findManualRecoveryCandidates(
  request: ManualRecoveryRequestRow,
): Promise<Omit<Candidate, "score">[]> {
  const candidates =
    request.applicantRole === "student"
      ? await findStudentCandidates(request)
      : await findTeacherCandidates(request);

  return candidates
    .sort(
      (left, right) =>
        right.score - left.score || left.name.localeCompare(right.name),
    )
    .slice(0, 10)
    .map(({ score: _score, ...candidate }) => candidate);
}

async function findStudentCandidates(request: ManualRecoveryRequestRow) {
  const filters = buildBaseCandidateFilters(request);
  const namePattern = toLikePattern(request.applicantName);
  const contactPattern = toLikePattern(request.applicantContact);

  filters.push(ilike(studentSignups.childName, namePattern));
  filters.push(ilike(studentSignups.phone, contactPattern));
  filters.push(ilike(studentSignups.contact, contactPattern));

  const rows = await db
    .select({
      contact: profiles.contact,
      email: users.email,
      name: profiles.name,
      profileId: profiles.id,
      studentAge: studentSignups.age,
      studentContact: studentSignups.contact,
      studentPhone: studentSignups.phone,
      studentStatus: studentSignups.status,
      userId: users.id,
      username: profiles.username,
    })
    .from(profiles)
    .innerJoin(users, eq(profiles.userId, users.id))
    .leftJoin(studentSignups, eq(studentSignups.profileId, profiles.id))
    .where(and(eq(profiles.role, "student"), or(...filters)))
    .limit(30);

  return rows.map((row) => ({
    contact: row.contact,
    email: isManagedLocalEmail(row.email) ? null : row.email,
    name: row.name,
    profileId: row.profileId,
    role: "student" as const,
    score: scoreCandidate(request, [
      row.name,
      row.username,
      row.contact,
      row.email,
      row.studentPhone,
      row.studentContact,
    ]),
    student: {
      age: row.studentAge,
      contact: row.studentContact,
      phone: row.studentPhone,
      status: row.studentStatus,
    },
    teacher: null,
    userId: row.userId,
    username: row.username,
  }));
}

async function findTeacherCandidates(request: ManualRecoveryRequestRow) {
  const filters = buildBaseCandidateFilters(request);
  const namePattern = toLikePattern(request.applicantName);
  const contactPattern = toLikePattern(request.applicantContact);

  filters.push(ilike(teacherSignups.school, contactPattern));
  filters.push(ilike(teacherSignups.grade, contactPattern));
  filters.push(ilike(teacherSignups.school, namePattern));

  const rows = await db
    .select({
      contact: profiles.contact,
      email: users.email,
      name: profiles.name,
      profileId: profiles.id,
      teacherGrade: teacherSignups.grade,
      teacherSchool: teacherSignups.school,
      teacherStatus: teacherSignups.status,
      userId: users.id,
      username: profiles.username,
    })
    .from(profiles)
    .innerJoin(users, eq(profiles.userId, users.id))
    .leftJoin(teacherSignups, eq(teacherSignups.profileId, profiles.id))
    .where(and(eq(profiles.role, "teacher"), or(...filters)))
    .limit(30);

  return rows.map((row) => ({
    contact: row.contact,
    email: isManagedLocalEmail(row.email) ? null : row.email,
    name: row.name,
    profileId: row.profileId,
    role: "teacher" as const,
    score: scoreCandidate(request, [
      row.name,
      row.username,
      row.contact,
      row.email,
      row.teacherSchool,
      row.teacherGrade,
    ]),
    student: null,
    teacher: {
      grade: row.teacherGrade,
      school: row.teacherSchool,
      status: row.teacherStatus,
    },
    userId: row.userId,
    username: row.username,
  }));
}

function buildBaseCandidateFilters(request: ManualRecoveryRequestRow) {
  const namePattern = toLikePattern(request.applicantName);
  const contactPattern = toLikePattern(request.applicantContact);
  return [
    ilike(profiles.name, namePattern),
    ilike(profiles.username, namePattern),
    ilike(profiles.username, contactPattern),
    ilike(profiles.contact, contactPattern),
    ilike(users.email, contactPattern),
  ] satisfies SQL[];
}

function scoreCandidate(request: ManualRecoveryRequestRow, values: unknown[]) {
  const applicantName = normalizeForLookup(request.applicantName);
  const applicantContact = normalizeForLookup(request.applicantContact);
  let score = 0;

  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = normalizeForLookup(value);
    if (!normalized) continue;

    if (normalized === applicantName) score += 80;
    else if (
      normalized.includes(applicantName) ||
      applicantName.includes(normalized)
    )
      score += 30;

    if (normalized === applicantContact) score += 90;
    else if (
      normalized.includes(applicantContact) ||
      applicantContact.includes(normalized)
    )
      score += 35;
  }

  return score;
}

function normalizeForLookup(value: string) {
  return value.trim().toLowerCase().replaceAll(/\s+/g, " ");
}

function toLikePattern(value: string) {
  const escaped = normalizeForLookup(value)
    .replaceAll("\\", "\\\\")
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
  return `%${escaped}%`;
}
