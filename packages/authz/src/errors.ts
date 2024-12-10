/**
 * Internal error type.
 */
export class AuthzError extends Error {
  cause?: unknown;

  constructor(message?: string, cause?: unknown) {
    super(message);
    this.name = 'AuthzError';
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Internal error type for verification error.
 */
export class AuthzVerificationError extends AuthzError {
  constructor(message?: string, cause?: unknown) {
    super(message, cause);
    this.name = 'AuthzVerificationError';
  }
}

/**
 * Internal error type for anonymous error.
 */
export class AuthzAnonymousError extends AuthzError {
  constructor(message?: string, cause?: unknown) {
    super(message, cause);
    this.name = 'AuthzAnonymousError';
  }
}
