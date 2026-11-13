// Errors that are safe to show to users: a stable code and a plain message. Anything else becomes a generic 500.
class AppError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

module.exports = { AppError };
