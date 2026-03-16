const { HttpError } = require("../utils/httpError");
const multer = require("multer");

function notFound(_req, _res, next) {
  next(new HttpError(404, "Not Found", "NOT_FOUND"));
}

function errorHandler(err, _req, res, _next) {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === "LIMIT_FILE_SIZE" ? "File exceeds maximum upload size" : err.message;
    return res.status(400).json({
      error: {
        code: err.code || "UPLOAD_ERROR",
        message
      }
    });
  }

  const status = err.status || 500;
  const isServerError = status >= 500;
  const payload = isServerError
    ? {
        error: {
          code: "INTERNAL_ERROR",
          message: "Internal Server Error"
        }
      }
    : {
        error: {
          code: err.code || "HTTP_ERROR",
          message: err.message || "Request failed"
        }
      };

  if (err.details && !isServerError && process.env.NODE_ENV !== "production") {
    payload.error.details = err.details;
  }

  if (isServerError) {
    // eslint-disable-next-line no-console
    console.error(err);
  }

  res.status(status).json(payload);
}

module.exports = {
  notFound,
  errorHandler
};
