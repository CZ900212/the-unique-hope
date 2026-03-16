const { HttpError } = require("../utils/httpError");

function requireRole(...roles) {
  return (req, _res, next) => {
    const currentRole = req.auth?.user?.role;
    if (!currentRole) {
      return next(new HttpError(401, "Authentication required", "UNAUTHENTICATED"));
    }
    if (!roles.includes(currentRole)) {
      return next(new HttpError(403, "Forbidden", "FORBIDDEN"));
    }
    return next();
  };
}

module.exports = { requireRole };
