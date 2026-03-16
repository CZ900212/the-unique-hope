const express = require("express");
const bcrypt = require("bcrypt");
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { env } = require("../config/env");
const { db, tx } = require("../lib/instant");
const { authenticate } = require("../middleware/auth");
const { asyncHandler } = require("../utils/asyncHandler");
const { HttpError } = require("../utils/httpError");
const { clearAuthCookies, writeAuthCookies } = require("../utils/authCookies");
const {
  writeCsrfCookie,
  requireCsrf,
  requireTrustedOrigin,
  CSRF_COOKIE
} = require("../middleware/csrf");
const { loginSchema, validateBody } = require("../utils/validators");

const router = express.Router();
const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

function loginRateLimitExceeded(_req, res) {
  res.status(429).json({
    error: {
      code: "TOO_MANY_REQUESTS",
      message: "Too many login attempts, try again later"
    }
  });
}

function normalizeIdentifier(identifierRaw) {
  if (typeof identifierRaw !== "string") {
    return "";
  }
  return identifierRaw.trim().toLowerCase();
}

function getIpKey(req) {
  return ipKeyGenerator(req.ip || req.socket?.remoteAddress || "");
}

const loginIpRateLimiter = rateLimit({
  windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getIpKey(req),
  handler: loginRateLimitExceeded
});

const loginIdentifierRateLimiter = rateLimit({
  windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const identifier = normalizeIdentifier(req.body?.identifier);
    if (identifier) {
      return `identifier:${identifier}`;
    }
    return `ip:${getIpKey(req)}`;
  },
  handler: loginRateLimitExceeded
});

function isEmailIdentifier(value) {
  return value.includes("@");
}

async function resolveProfile(identifierRaw) {
  const identifier = identifierRaw.trim().toLowerCase();

  if (isEmailIdentifier(identifier)) {
    const { profiles } = await db.query({
      profiles: { $: { where: { "user.email": identifier } }, user: {} }
    });
    return profiles?.[0] || null;
  }

  const { profiles } = await db.query({
    profiles: { $: { where: { username: identifier } }, user: {} }
  });
  return profiles?.[0] || null;
}

async function ensureProfileLinkedToAuth(profile, fallbackEmail) {
  const email = fallbackEmail.trim().toLowerCase();
  if (profile.user?.[0]?.id) {
    return;
  }

  const authUser = await db.auth.getUser({ email });
  if (!authUser?.id) {
    throw new HttpError(403, "Auth user not found for profile", "AUTH_USER_NOT_FOUND");
  }

  await db.transact([
    tx.profiles[profile.id].link({ user: authUser.id })
  ]);
}

router.post(
  "/login",
  requireTrustedOrigin,
  loginIpRateLimiter,
  loginIdentifierRateLimiter,
  asyncHandler(async (req, res) => {
    const body = validateBody(loginSchema, req.body);
    const profile = await resolveProfile(body.identifier);

    if (!profile || !profile.passwordHash) {
      throw new HttpError(401, "Invalid credentials", "INVALID_CREDENTIALS");
    }

    const passwordValid = await bcrypt.compare(body.password, profile.passwordHash);
    if (!passwordValid) {
      throw new HttpError(401, "Invalid credentials", "INVALID_CREDENTIALS");
    }

    if (profile.role !== body.role) {
      throw new HttpError(403, "Role mismatch", "ROLE_MISMATCH");
    }

    const authEmail =
      profile.user?.[0]?.email ||
      `${profile.username}.${profile.role}@${env.AUTH_LOCAL_EMAIL_DOMAIN}`;
    const email = authEmail.trim().toLowerCase();

    await ensureProfileLinkedToAuth(profile, email);
    const token = await db.auth.createToken({ email });

    writeAuthCookies(res, token);
    writeCsrfCookie(res);

    res.json({
      user: {
        id: profile.id,
        email,
        role: profile.role,
        name: profile.name,
        username: profile.username
      }
    });
  })
);

router.post(
  "/logout",
  requireCsrf,
  asyncHandler(async (req, res) => {
    clearAuthCookies(res);
    res.clearCookie(CSRF_COOKIE, {
      httpOnly: false,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/"
    });

    res.json({ ok: true });
  })
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (req, res) => {
    if (!req.cookies?.[CSRF_COOKIE]) {
      writeCsrfCookie(res);
    }

    res.json({
      id: req.auth.user.id,
      role: req.auth.user.role,
      email: req.auth.user.email,
      name: req.auth.user.name,
      username: req.auth.user.username
    });
  })
);

module.exports = { authRouter: router };
