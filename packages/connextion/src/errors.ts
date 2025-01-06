/**
 * Internal error type.
 */
export class ConnextionError extends Error {
  cause?: unknown;

  constructor(message?: string, cause?: unknown) {
    super(message);
    this.name = 'ConnextionError';
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
