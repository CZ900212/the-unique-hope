const express = require("express");
const crypto = require("crypto");
const { db, tx } = require("../lib/instant");
const { authenticate } = require("../middleware/auth");
const { requireCsrf } = require("../middleware/csrf");
const { requireRole } = require("../middleware/requireRole");
const { getPairingForStudent } = require("../services/pairingService");
const { asyncHandler } = require("../utils/asyncHandler");
const { HttpError } = require("../utils/httpError");
const { TOTAL_WEEKS } = require("../constants/lesson");
const {
  feedbackUpsertSchema,
  parseWeek,
  validateBody
} = require("../utils/validators");

const router = express.Router();

function deterministicId(seed) {
  const hashed = crypto.createHash("sha256").update(seed).digest("hex");
  return `feedback-${hashed}`;
}

router.use(authenticate, requireRole("student"));

router.get(
  "/me/dashboard",
  asyncHandler(async (req, res) => {
    const pairing = await getPairingForStudent(req.auth.user.id);
    const { lessons } = await db.query({
      lessons: {
        $: { where: { "pairing.id": pairing.id } }
      }
    });

    const byWeek = new Map((lessons || []).map((l) => [l.weekNumber, l]));
    const weeks = Array.from({ length: TOTAL_WEEKS }, (_, index) => {
      const weekNumber = index + 1;
      const lesson = byWeek.get(weekNumber);
      return {
        weekNumber,
        status: lesson?.status || "pending",
        hasEvidence: Boolean(lesson?.evidencePath)
      };
    });

    const taughtCount = weeks.filter((week) => week.status === "taught").length;
    const teacher = pairing.teacher?.[0] || null;

    res.json({
      student: {
        id: req.auth.user.id,
        name: req.auth.user.name
      },
      teacher,
      progress: {
        taughtCount,
        totalWeeks: TOTAL_WEEKS,
        weeks
      }
    });
  })
);

router.get(
  "/me/lessons/:week",
  asyncHandler(async (req, res) => {
    const week = parseWeek(req.params.week);
    const pairing = await getPairingForStudent(req.auth.user.id);

    const { lessons } = await db.query({
      lessons: {
        $: { where: { "pairing.id": pairing.id, weekNumber: week } },
        notes: {}
      }
    });

    const lesson = lessons?.[0];

    if (lesson) {
      // Get shared notes only
      const note = lesson.notes?.[0];
      const sharedNote = note?.visibility === "shared" ? note : null;

      // Get feedback for this week
      const { feedback: feedbackRows } = await db.query({
        feedback: {
          $: {
            where: {
              "pairing.id": pairing.id,
              weekNumber: week,
              "student.id": req.auth.user.id
            }
          }
        }
      });
      const feedbackRow = feedbackRows?.[0] || null;

      let evidenceSignedUrl = null;
      if (lesson.evidencePath) {
        try {
          evidenceSignedUrl = await db.storage.getDownloadUrl(lesson.evidencePath);
        } catch {
          evidenceSignedUrl = null;
        }
      }

      return res.json({
        lesson: {
          weekNumber: week,
          status: lesson.status,
          evidenceUrl: evidenceSignedUrl,
          notes: sharedNote
            ? { text: sharedNote.text, visibility: sharedNote.visibility, updated_at: sharedNote.updatedAt }
            : null
        },
        feedback: feedbackRow
          ? {
              text: feedbackRow.text,
              rating: feedbackRow.rating,
              visibility: feedbackRow.visibility,
              updated_at: feedbackRow.updatedAt
            }
          : null
      });
    }

    res.json({
      lesson: {
        weekNumber: week,
        status: "pending",
        evidenceUrl: null,
        notes: null
      },
      feedback: null
    });
  })
);

router.put(
  "/me/feedback/:week",
  requireCsrf,
  asyncHandler(async (req, res) => {
    const week = parseWeek(req.params.week);
    const body = validateBody(feedbackUpsertSchema, req.body);
    const pairing = await getPairingForStudent(req.auth.user.id);
    const now = Date.now();

    // Query existing feedback for this pairing+week+student
    const { feedback: existing } = await db.query({
      feedback: {
        $: {
          where: {
            "pairing.id": pairing.id,
            weekNumber: week,
            "student.id": req.auth.user.id
          }
        }
      }
    });

    const txns = [];
    let feedbackId;

    if (existing?.[0]) {
      feedbackId = existing[0].id;
      txns.push(
        tx.feedback[feedbackId].update({
          text: body.text,
          rating: body.rating,
          visibility: body.visibility,
          updatedAt: now
        })
      );
    } else {
      feedbackId = deterministicId(`feedback:${pairing.id}:student:${req.auth.user.id}:week:${week}`);
      txns.push(
        tx.feedback[feedbackId].update({
          weekNumber: week,
          text: body.text,
          rating: body.rating,
          visibility: body.visibility,
          updatedAt: now
        }),
        tx.feedback[feedbackId].link({ pairing: pairing.id }),
        tx.feedback[feedbackId].link({ student: req.auth.user.id })
      );
    }

    await db.transact(txns);

    res.json({
      feedback: {
        id: feedbackId,
        week_number: week,
        text: body.text,
        rating: body.rating,
        visibility: body.visibility,
        updated_at: now
      }
    });
  })
);

module.exports = { studentRouter: router };
