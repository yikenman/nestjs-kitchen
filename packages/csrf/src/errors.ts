/**
 * Internal error type.
 */
export class CsrfError extends Error {
  cause?: unknown;

  constructor(message?: string | Error, cause?: unknown) {
    super(typeof message === 'string' ? message : message?.message);
    this.name = 'CsrfError';
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class CsrfMissingError extends CsrfError {
  constructor(message?: string, cause?: unknown) {
    super(message, cause);
    this.name = 'CsrfMissingError';
  }
}

export class CsrfInvalidError extends CsrfError {
  constructor(message?: string, cause?: unknown) {
    super(message, cause);
    this.name = 'CsrfInvalidError';
  }
}

export class CsrfMismatchError extends CsrfError {
  constructor(message?: string, cause?: unknown) {
    super(message, cause);
    this.name = 'CsrfMismatchError';
  }
}
