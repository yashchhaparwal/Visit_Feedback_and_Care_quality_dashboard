export class HttpError extends Error {
  /**
   * @param {number} status HTTP status code
   * @param {string} code   machine-readable code the client can switch on
   * @param {string} message human-readable message
   */
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
