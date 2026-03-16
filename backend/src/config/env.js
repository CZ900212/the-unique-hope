const dotenv = require("dotenv");

dotenv.config();

function parseTrustProxy(value, nodeEnv) {
  if (value === undefined) {
    return nodeEnv === "production" ? 1 : false;
  }

  if (value === "true") return true;
  if (value === "false") return false;

  const numeric = Number(value);
  if (!Number.isNaN(numeric)) return numeric;

  return value;
}

function parseTrustedOrigins(value, fallbackOrigin) {
  if (typeof value === "string" && value.trim().length > 0) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  if (fallbackOrigin) {
    return [fallbackOrigin];
  }

  return [];
}

const nodeEnv = process.env.NODE_ENV || "development";
const instantConfigured = Boolean(
  process.env.INSTANT_APP_ID && process.env.INSTANT_ADMIN_TOKEN
);

if (!instantConfigured && nodeEnv === "production") {
  throw new Error("Missing required env vars: INSTANT_APP_ID and INSTANT_ADMIN_TOKEN");
}

const env = {
  NODE_ENV: nodeEnv,
  PORT: Number(process.env.PORT || 8080),
  TRUST_PROXY: parseTrustProxy(process.env.TRUST_PROXY, nodeEnv),
  CORS_ORIGIN: process.env.CORS_ORIGIN || "http://localhost:5173",
  CSRF_TRUSTED_ORIGINS: parseTrustedOrigins(
    process.env.CSRF_TRUSTED_ORIGINS,
    process.env.CORS_ORIGIN || "http://localhost:5173"
  ),
  INSTANT_APP_ID: process.env.INSTANT_APP_ID || "",
  INSTANT_ADMIN_TOKEN: process.env.INSTANT_ADMIN_TOKEN || "",
  INSTANT_CONFIGURED: instantConfigured,
  AUTH_COOKIE_NAME: process.env.AUTH_COOKIE_NAME || "uh_access_token",
  AUTH_COOKIE_MAX_AGE_MS: Number(
    process.env.AUTH_COOKIE_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000
  ),
  AUTH_LOCAL_EMAIL_DOMAIN: process.env.AUTH_LOCAL_EMAIL_DOMAIN || "auth.uniquehope.local",
  MAX_UPLOAD_MB: Number(process.env.MAX_UPLOAD_MB || 5)
};

module.exports = { env };
