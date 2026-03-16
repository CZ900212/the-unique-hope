const { env } = require("../config/env");

function cookieBaseOptions() {
  return {
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
  };
}

function writeAuthCookies(res, token) {
  if (!token) {
    return;
  }

  res.cookie(env.AUTH_COOKIE_NAME, token, {
    ...cookieBaseOptions(),
    httpOnly: true,
    maxAge: env.AUTH_COOKIE_MAX_AGE_MS
  });
}

function clearAuthCookies(res) {
  res.clearCookie(env.AUTH_COOKIE_NAME, {
    ...cookieBaseOptions(),
    httpOnly: true
  });
}

module.exports = {
  writeAuthCookies,
  clearAuthCookies
};
