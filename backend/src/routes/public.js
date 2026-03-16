const express = require("express");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { db, id, tx } = require("../lib/instant");
const { asyncHandler } = require("../utils/asyncHandler");
const { studentSignupSchema, validateBody } = require("../utils/validators");

const router = express.Router();

const signupRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip || req.socket?.remoteAddress || ""),
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: "TOO_MANY_REQUESTS",
        message: "Too many signup attempts, try again later"
      }
    });
  }
});

router.post(
  "/student-signups",
  signupRateLimiter,
  asyncHandler(async (req, res) => {
    const body = validateBody(studentSignupSchema, req.body);
    const signupId = id();
    const now = Date.now();

    await db.transact([
      tx.studentSignups[signupId].update({
        childName: body.childName,
        age: body.age,
        phone: body.phone,
        contact: body.contact || "",
        status: "pending",
        rejectReason: "",
        createdAt: now
      })
    ]);

    res.status(201).json({
      signup: { id: signupId, status: "pending", createdAt: now }
    });
  })
);

module.exports = { publicRouter: router };
