const express = require("express");
const crypto = require("crypto");
const multer = require("multer");
const { env } = require("../config/env");
const { db, tx } = require("../lib/instant");
const { authenticate } = require("../middleware/auth");
const { requireCsrf } = require("../middleware/csrf");
const { requireRole } = require("../middleware/requireRole");
const { getPairingForTeacher } = require("../services/pairingService");
const { asyncHandler } = require("../utils/asyncHandler");
const { HttpError } = require("../utils/httpError");
const { TOTAL_WEEKS } = require("../constants/lesson");
const {
  lessonUpdateSchema,
  parseWeek,
  validateBody
} = require("../utils/validators");

const router = express.Router();
const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function deterministicId(seed) {
  const hashed = crypto.createHash("sha256").update(seed).digest("hex");
  return `lesson-${hashed}`;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      cb(new HttpError(400, "Unsupported file type", "BAD_FILE_TYPE"));
      return;
    }
    cb(null, true);
  }
});

let fileTypeModulePromise = null;

async function fileTypeFromBuffer(buffer) {
  if (!fileTypeModulePromise) {
    fileTypeModulePromise = import("file-type");
  }
  const { fileTypeFromBuffer: detector } = await fileTypeModulePromise;
  return detector(buffer);
}

router.use(authenticate, requireRole("teacher"));

router.get(
  "/me/dashboard",
  asyncHandler(async (req, res) => {
    const pairing = await getPairingForTeacher(req.auth.user.id);
    const { feedback: sharedFeedback } = await db.query({
      feedback: {
        $: {
          where: {
            "pairing.id": pairing.id,
            visibility: "shared"
          },
          order: { weekNumber: "desc" }
        }
      }
    });

    const { lessons: pairingLessons } = await db.query({
      lessons: {
        $: { where: { "pairing.id": pairing.id }, order: { weekNumber: "asc" } },
        notes: {}
      }
    });

    const hydratedLessons = await Promise.all(
      (pairingLessons || []).map(async (lesson) => {
        let evidenceUrl = null;
        if (lesson.evidencePath) {
          try {
            evidenceUrl = await db.storage.getDownloadUrl(lesson.evidencePath);
          } catch {
            evidenceUrl = null;
          }
        }
        const note = lesson.notes?.[0] || null;
        return {
          id: lesson.id,
          week_number: lesson.weekNumber,
          status: lesson.status,
          evidence_path: lesson.evidencePath || null,
          updated_at: lesson.updatedAt,
          evidenceUrl,
          notes: note
            ? { text: note.text, visibility: note.visibility, updated_at: note.updatedAt }
            : null
        };
      })
    );

    const taughtCount = hydratedLessons.filter((item) => item.status === "taught").length;
    const student = pairing.student?.[0] || null;

    res.json({
      teacher: {
        id: req.auth.user.id,
        name: req.auth.user.name
      },
      student,
      progress: {
        taughtCount,
        totalWeeks: TOTAL_WEEKS,
        lessons: hydratedLessons
      },
      latestSharedFeedback: sharedFeedback?.[0]
        ? {
            week_number: sharedFeedback[0].weekNumber,
            text: sharedFeedback[0].text,
            rating: sharedFeedback[0].rating,
            visibility: sharedFeedback[0].visibility,
            updated_at: sharedFeedback[0].updatedAt
          }
        : null
    });
  })
);

router.put(
  "/me/lessons/:week",
  requireCsrf,
  asyncHandler(async (req, res) => {
    const week = parseWeek(req.params.week);
    const body = validateBody(lessonUpdateSchema, req.body);
    const pairing = await getPairingForTeacher(req.auth.user.id);
    const now = Date.now();

    // Query existing lesson for this pairing+week
    const { lessons: existing } = await db.query({
      lessons: {
        $: { where: { "pairing.id": pairing.id, weekNumber: week } },
        notes: {}
      }
    });

    let lessonId;
    const txns = [];

    if (existing?.[0]) {
      lessonId = existing[0].id;
      txns.push(
        tx.lessons[lessonId].update({
          status: body.status,
          updatedAt: now
        })
      );
    } else {
      lessonId = deterministicId(`lesson:${pairing.id}:week:${week}`);
      txns.push(
        tx.lessons[lessonId].update({
          weekNumber: week,
          status: body.status,
          updatedAt: now
        }),
        tx.lessons[lessonId].link({ pairing: pairing.id })
      );
    }

    // Upsert note
    const existingNote = existing?.[0]?.notes?.[0];
    if (existingNote) {
      txns.push(
        tx.lessonNotes[existingNote.id].update({
          text: body.notesText,
          visibility: body.notesVisibility,
          updatedAt: now
        })
      );
    } else {
      const noteId = deterministicId(`lesson-note:${pairing.id}:week:${week}`);
      txns.push(
        tx.lessonNotes[noteId].update({
          text: body.notesText,
          visibility: body.notesVisibility,
          updatedAt: now
        }),
        tx.lessonNotes[noteId].link({ lesson: lessonId })
      );
    }

    await db.transact(txns);

    // Re-query to return fresh data
    const { lessons: updated } = await db.query({
      lessons: {
        $: { where: { id: lessonId } },
        notes: {}
      }
    });

    const lesson = updated?.[0];
    const note = lesson?.notes?.[0];

    res.json({
      lesson: {
        id: lesson?.id || lessonId,
        pairing_id: pairing.id,
        week_number: week,
        status: lesson?.status || body.status,
        evidence_path: lesson?.evidencePath || null,
        updated_at: lesson?.updatedAt || now,
        notes: note
          ? {
              lesson_id: lessonId,
              text: note.text,
              visibility: note.visibility,
              updated_at: note.updatedAt
            }
          : null
      }
    });
  })
);

router.post(
  "/me/lessons/:week/evidence",
  requireCsrf,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const week = parseWeek(req.params.week);
    if (!req.file) {
      throw new HttpError(400, "file is required", "FILE_REQUIRED");
    }

    const pairing = await getPairingForTeacher(req.auth.user.id);
    const mimeToExt = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    const extension = mimeToExt[req.file.mimetype];
    if (!extension) {
      throw new HttpError(400, "Unsupported file type", "BAD_FILE_TYPE");
    }
    const detectedType = await fileTypeFromBuffer(req.file.buffer);
    if (!detectedType || !ALLOWED_IMAGE_MIME_TYPES.has(detectedType.mime)) {
      throw new HttpError(400, "Invalid file signature", "BAD_FILE_SIGNATURE");
    }
    if (detectedType.mime !== req.file.mimetype) {
      throw new HttpError(400, "File MIME mismatch", "BAD_FILE_SIGNATURE");
    }

    // Check existing lesson
    const { lessons: existing } = await db.query({
      lessons: { $: { where: { "pairing.id": pairing.id, weekNumber: week } } }
    });
    const existingLesson = existing?.[0];

    const path = `${pairing.id}/week-${week}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    try {
      await db.storage.uploadFile(path, req.file.buffer);
    } catch (uploadErr) {
      throw new HttpError(400, "Failed to upload evidence", "UPLOAD_FAILED", {
        reason: uploadErr?.message
      });
    }

    const now = Date.now();
    let lessonId;
    const txns = [];

    if (existingLesson) {
      lessonId = existingLesson.id;
      txns.push(
        tx.lessons[lessonId].update({
          evidencePath: path,
          updatedAt: now
        })
      );
    } else {
      lessonId = deterministicId(`lesson:${pairing.id}:week:${week}`);
      txns.push(
        tx.lessons[lessonId].update({
          weekNumber: week,
          status: "pending",
          evidencePath: path,
          updatedAt: now
        }),
        tx.lessons[lessonId].link({ pairing: pairing.id })
      );
    }

    try {
      await db.transact(txns);
    } catch (txErr) {
      await db.storage.delete(path).catch(() => null);
      throw new HttpError(400, "Failed to save evidence path", "LESSON_EVIDENCE_SAVE_FAILED", {
        reason: txErr?.message
      });
    }

    // Cleanup old evidence
    if (existingLesson?.evidencePath && existingLesson.evidencePath !== path) {
      await db.storage.delete(existingLesson.evidencePath).catch(() => null);
    }

    let downloadUrl = null;
    try {
      downloadUrl = await db.storage.getDownloadUrl(path);
    } catch {
      console.error("Evidence saved but download URL generation failed", {
        pairingId: pairing.id,
        week,
        path
      });
    }

    res.status(201).json({
      lesson: {
        id: lessonId,
        week_number: week,
        status: existingLesson?.status || "pending",
        evidence_path: path,
        updated_at: now
      },
      evidence: {
        path,
        signedUrl: downloadUrl,
        expiresInSeconds: downloadUrl ? Math.floor((env.AUTH_COOKIE_MAX_AGE_MS || 0) / 1000) : null
      },
      warning: downloadUrl ? null : "SIGNED_URL_UNAVAILABLE"
    });
  })
);

module.exports = { teacherRouter: router };
