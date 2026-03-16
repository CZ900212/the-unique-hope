const express = require("express");
const bcrypt = require("bcrypt");
const { env } = require("../config/env");
const { db, id, tx } = require("../lib/instant");
const { authenticate } = require("../middleware/auth");
const { requireCsrf } = require("../middleware/csrf");
const { requireRole } = require("../middleware/requireRole");
const { asyncHandler } = require("../utils/asyncHandler");
const { HttpError } = require("../utils/httpError");
const { TOTAL_WEEKS } = require("../constants/lesson");
const {
  createPairingSchema,
  cleanupUsersSchema,
  idParamSchema,
  paginationSchema,
  signupListQuerySchema,
  signupReviewSchema,
  validateBody,
  validateParams,
  validateQuery
} = require("../utils/validators");

const router = express.Router();
const BCRYPT_ROUNDS = 12;

router.use(authenticate, requireRole("admin"));

function toCanonicalEmail(email, username, role) {
  if (email) {
    return email.trim().toLowerCase();
  }
  return `${username}.${role}@${env.AUTH_LOCAL_EMAIL_DOMAIN}`;
}

async function ensureAuthUser(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await db.auth.getUser({ email: normalizedEmail });
  if (existing?.id) {
    return { user: existing, created: false };
  }

  await db.auth.createToken({ email: normalizedEmail });
  const created = await db.auth.getUser({ email: normalizedEmail });
  if (!created?.id) {
    throw new HttpError(502, "Failed to create auth user", "AUTH_USER_CREATION_FAILED");
  }

  return { user: created, created: true };
}

async function cleanupAuthUsers(authUsers) {
  for (const user of authUsers) {
    try {
      await db.auth.deleteUser({ id: user.id });
    } catch {
      // best effort cleanup to avoid stale auth user build-up
    }
  }
}

router.post(
  "/pairings",
  requireCsrf,
  asyncHandler(async (req, res) => {
    const body = validateBody(createPairingSchema, req.body);

    const teacherEmail = toCanonicalEmail(
      body.teacher.email,
      body.teacher.username,
      "teacher"
    );
    const studentEmail = toCanonicalEmail(
      body.student.email,
      body.student.username,
      "student"
    );

    const [teacherHash, studentHash] = await Promise.all([
      bcrypt.hash(body.teacher.password, BCRYPT_ROUNDS),
      bcrypt.hash(body.student.password, BCRYPT_ROUNDS)
    ]);

    const teacherId = id();
    const studentId = id();
    const pairingId = id();
    const now = Date.now();

    const profileTxns = [
      tx.profiles[teacherId].update({
        role: "teacher",
        username: body.teacher.username,
        name: body.teacher.name,
        contact: body.teacher.contact || "",
        passwordHash: teacherHash,
        createdAt: now
      }),
      tx.profiles[studentId].update({
        role: "student",
        username: body.student.username,
        name: body.student.name,
        contact: body.student.contact || "",
        passwordHash: studentHash,
        createdAt: now
      }),
      tx.pairings[pairingId].update({ createdAt: now }),
      tx.pairings[pairingId].link({ teacher: teacherId }),
      tx.pairings[pairingId].link({ student: studentId })
    ];

  // Create auth users so tokens can be issued
  let teacherAuthUser;
  let studentAuthUser;

  try {
    teacherAuthUser = await ensureAuthUser(teacherEmail);
    studentAuthUser = await ensureAuthUser(studentEmail);
  } catch (err) {
    await cleanupAuthUsers(
      [teacherAuthUser, studentAuthUser]
        .filter(Boolean)
        .filter((item) => item.created)
        .map((item) => item.user)
    );
    throw err;
  }

  const createdAuthUsers = [
    ...(teacherAuthUser.created ? [teacherAuthUser.user] : []),
    ...(studentAuthUser.created ? [studentAuthUser.user] : [])
  ];

  profileTxns.push(
    tx.profiles[teacherId].link({ user: teacherAuthUser.user.id }),
    tx.profiles[studentId].link({ user: studentAuthUser.user.id })
  );

  try {
    await db.transact(profileTxns);
  } catch (err) {
    await cleanupAuthUsers(createdAuthUsers);
    throw err;
  }

    res.status(201).json({
      pairing: {
        id: pairingId,
        createdAt: new Date(now).toISOString(),
        teacher: {
          id: teacherId,
          name: body.teacher.name,
          role: "teacher",
          username: body.teacher.username
        },
        student: {
          id: studentId,
          name: body.student.name,
          role: "student",
          username: body.student.username,
          contact: body.student.contact || null
        }
      }
    });
  })
);

router.get(
  "/pairings",
  asyncHandler(async (req, res) => {
    const { page, pageSize } = validateQuery(paginationSchema, req.query);

    const { pairings: totalPairings } = await db.query({
      pairings: {
        $: { order: { serverCreatedAt: "desc" } },
        teacher: {},
        student: {},
        lessons: {}
      }
    });

    const total = totalPairings?.length || 0;
    const from = (page - 1) * pageSize;
    let sliced;

    try {
      const { pairings } = await db.query({
        pairings: {
          $: {
            order: { serverCreatedAt: "desc" },
            limit: pageSize,
            offset: from
          },
          teacher: {},
          student: {},
          lessons: {}
        }
      });
      sliced = pairings || [];
    } catch (err) {
      const message = String(err?.message || "");
      if (!message.includes("limit") && !message.includes("offset")) {
        throw err;
      }
      sliced = (totalPairings || []).slice(from, from + pageSize);
    }

    const pairings = sliced.map((pairing) => {
      const lessons = pairing.lessons || [];
      const taughtCount = lessons.filter((l) => l.status === "taught").length;

      return {
        id: pairing.id,
        createdAt: pairing.createdAt,
        teacher: pairing.teacher?.[0] || null,
        student: pairing.student?.[0] || null,
        progress: {
          taughtCount,
          totalWeeks: TOTAL_WEEKS,
          lessons: lessons.map((l) => ({
            weekNumber: l.weekNumber,
            status: l.status
          }))
        }
      };
    });

    res.json({
      pairings,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  })
);

router.delete(
  "/pairings/:id",
  requireCsrf,
  asyncHandler(async (req, res) => {
    const params = validateParams(idParamSchema, req.params);

    const { pairings } = await db.query({
      pairings: {
        $: { where: { id: params.id } },
        teacher: { user: {} },
        student: { user: {} },
        lessons: { notes: {} },
        feedback: {}
      }
    });

    const pairing = pairings?.[0];
    if (!pairing) {
      throw new HttpError(404, "Pairing not found", "PAIRING_NOT_FOUND");
    }

    // Collect evidence paths for storage cleanup
    const evidencePaths = (pairing.lessons || [])
      .map((l) => l.evidencePath)
      .filter(Boolean);

    // Build cascade delete transactions
    const deleteTxns = [];

    for (const fb of pairing.feedback || []) {
      deleteTxns.push(tx.feedback[fb.id].delete());
    }
    for (const lesson of pairing.lessons || []) {
      if (lesson.notes?.[0]) {
        deleteTxns.push(tx.lessonNotes[lesson.notes[0].id].delete());
      }
      deleteTxns.push(tx.lessons[lesson.id].delete());
    }
    deleteTxns.push(tx.pairings[pairing.id].delete());

    const teacher = pairing.teacher?.[0];
    const student = pairing.student?.[0];
    if (teacher) deleteTxns.push(tx.profiles[teacher.id].delete());
    if (student) deleteTxns.push(tx.profiles[student.id].delete());

    await db.transact(deleteTxns);

    // Cleanup auth users
    const failedCleanup = [];
    for (const profile of [teacher, student].filter(Boolean)) {
      const authUserId = profile.user?.[0]?.id || null;
      const authEmail =
        profile.user?.[0]?.email ||
        `${profile.username}.${profile.role}@${env.AUTH_LOCAL_EMAIL_DOMAIN}`;
      try {
        if (authUserId) {
          await db.auth.deleteUser({ id: authUserId });
        } else {
          await db.auth.deleteUser({ email: authEmail });
        }
      } catch (err) {
        failedCleanup.push({
          profileId: profile.id,
          userId: authUserId,
          reason: err?.message || "deleteUser failed"
        });
      }
    }

    // Cleanup evidence files
    const failedEvidencePaths = [];
    for (const path of [...new Set(evidencePaths)]) {
      try {
        await db.storage.delete(path);
      } catch {
        failedEvidencePaths.push(path);
      }
    }

    if (failedCleanup.length > 0 || failedEvidencePaths.length > 0) {
      console.error("Pairing deleted with partial cleanup", {
        pairingId: params.id,
        failedCleanup,
        failedEvidencePaths
      });
      return res.status(202).json({
        ok: true,
        cleanup: {
          status: "partial",
          failedUserIds: failedCleanup.map((item) => item.userId).filter(Boolean),
          failedEvidencePaths,
          retryPath: failedCleanup.some((item) => item.userId) ? "/api/admin/users/cleanup" : null
        }
      });
    }

    res.json({ ok: true });
  })
);

router.post(
  "/users/cleanup",
  requireCsrf,
  asyncHandler(async (req, res) => {
    const body = validateBody(cleanupUsersSchema, req.body);
    const failedCleanup = [];

    for (const userId of body.userIds.filter(Boolean)) {
      try {
        await db.auth.deleteUser({ id: userId });
      } catch (err) {
        failedCleanup.push({ userId, reason: err?.message || "deleteUser failed" });
      }
    }

    if (failedCleanup.length > 0) {
      return res.status(202).json({
        ok: true,
        cleanup: {
          status: "partial",
          failedUserIds: failedCleanup.map((item) => item.userId)
        }
      });
    }

    return res.json({ ok: true, cleanup: { status: "complete", failedUserIds: [] } });
  })
);

router.get(
  "/student-signups",
  asyncHandler(async (req, res) => {
    const { page, pageSize, status } = validateQuery(signupListQuerySchema, req.query);

    const queryOpts = { order: { serverCreatedAt: "desc" } };
    if (status !== "all") {
      queryOpts.where = { status };
    }

    const { studentSignups: allSignups } = await db.query({
      studentSignups: { $: queryOpts }
    });

    const total = allSignups?.length || 0;
    const from = (page - 1) * pageSize;

    let sliced;
    try {
      const limitOpts = { ...queryOpts, limit: pageSize, offset: from };
      const { studentSignups } = await db.query({
        studentSignups: { $: limitOpts }
      });
      sliced = studentSignups || [];
    } catch (err) {
      const message = String(err?.message || "");
      if (!message.includes("limit") && !message.includes("offset")) {
        throw err;
      }
      sliced = (allSignups || []).slice(from, from + pageSize);
    }

    const signups = sliced.map((s) => ({
      id: s.id,
      childName: s.childName,
      age: s.age,
      phone: s.phone,
      contact: s.contact || "",
      status: s.status,
      rejectReason: s.rejectReason || "",
      createdAt: s.createdAt,
      reviewedAt: s.reviewedAt || null
    }));

    res.json({
      signups,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    });
  })
);

router.patch(
  "/student-signups/:id/review",
  requireCsrf,
  asyncHandler(async (req, res) => {
    const params = validateParams(idParamSchema, req.params);
    const body = validateBody(signupReviewSchema, req.body);

    const { studentSignups } = await db.query({
      studentSignups: { $: { where: { id: params.id } } }
    });

    const signup = studentSignups?.[0];
    if (!signup) {
      throw new HttpError(404, "Signup not found", "SIGNUP_NOT_FOUND");
    }

    if (signup.status !== "pending") {
      throw new HttpError(409, "Signup already reviewed", "SIGNUP_ALREADY_REVIEWED");
    }

    const now = Date.now();
    const updates = {
      status: body.action === "approve" ? "approved" : "rejected",
      reviewedAt: now,
      rejectReason: body.action === "reject" ? body.reason : ""
    };

    await db.transact([tx.studentSignups[params.id].update(updates)]);

    res.json({
      signup: {
        id: params.id,
        childName: signup.childName,
        age: signup.age,
        phone: signup.phone,
        contact: signup.contact || "",
        status: updates.status,
        rejectReason: updates.rejectReason,
        createdAt: signup.createdAt,
        reviewedAt: now
      }
    });
  })
);

module.exports = { adminRouter: router };
