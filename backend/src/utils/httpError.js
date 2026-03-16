class HttpError extends Error {
  constructor(status, message, code = "HTTP_ERROR", details = null) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

module.exports = { HttpError };
