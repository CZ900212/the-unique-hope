const crypto = require("crypto");
const { env } = require("../config/env");
const { HttpError } = require("../utils/httpError");

const CSRF_COOKIE = "uh_csrf_token";
const CSRF_HEADER = "x-csrf-token";
const SAFE_ORIGIN_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function writeCsrfCookie(res) {
  const token = crypto.randomBytes(32).toString("hex");
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: env.AUTH_COOKIE_MAX_AGE_MS
  });
  return token;
}

function tokensMatch(cookieToken, headerToken) {
  if (!cookieToken || !headerToken) {
    return false;
  }
  const cookieBuffer = Buffer.from(cookieToken, "utf8");
  const headerBuffer = Buffer.from(headerToken, "utf8");
  if (cookieBuffer.length !== headerBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(cookieBuffer, headerBuffer);
}

function requireCsrf(req, res, next) {
  const cookieToken = req.cookies[CSRF_COOKIE];
  const headerToken = req.get(CSRF_HEADER);

  if (!tokensMatch(cookieToken, headerToken)) {
    return next(new HttpError(403, "CSRF token missing or invalid", "CSRF_TOKEN_INVALID"));
  }

  writeCsrfCookie(res);
  next();
}

function hasBearerAuthorization(req) {
  return req.headers.authorization?.startsWith("Bearer ");
}

function extractOrigin(req) {
  const originHeader = req.get("origin");
  return originHeader ? originHeader.trim() : "";
}

function requireTrustedOrigin(req, _res, next) {
  if (SAFE_ORIGIN_METHODS.has(req.method.toUpperCase()) || hasBearerAuthorization(req)) {
    return next();
  }

  const origin = extractOrigin(req);
  if (!origin || !env.CSRF_TRUSTED_ORIGINS.includes(origin)) {
    return next(new HttpError(403, "Origin not allowed", "ORIGIN_INVALID"));
  }

  return next();
}

module.exports = { writeCsrfCookie, requireCsrf, requireTrustedOrigin, CSRF_COOKIE };
