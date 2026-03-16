const { env } = require("../config/env");
const { db } = require("../lib/instant");
const { HttpError } = require("../utils/httpError");

async function authenticate(req, res, next) {
  try {
    const bearer = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null;
    const token = req.cookies[env.AUTH_COOKIE_NAME] || bearer;

    if (!token) {
      throw new HttpError(401, "Authentication required", "UNAUTHENTICATED");
    }

    let user;
    try {
      user = await db.auth.verifyToken(token);
    } catch {
      throw new HttpError(401, "Invalid access token", "INVALID_TOKEN");
    }

    if (!user) {
      throw new HttpError(401, "Invalid access token", "INVALID_TOKEN");
    }

    const { profiles } = await db.query({
      profiles: { $: { where: { "user.id": user.id } } }
    });

    const profile = profiles?.[0];
    if (!profile) {
      throw new HttpError(403, "Profile not found for current user", "PROFILE_NOT_FOUND");
    }

    req.auth = {
      token,
      user: {
        id: profile.id,
        email: user.email,
        role: profile.role,
        name: profile.name,
        username: profile.username,
        contact: profile.contact
      }
    };
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { authenticate };
