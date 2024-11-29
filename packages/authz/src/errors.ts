export class AuthzError extends Error {
  cause?: unknown;

  constructor(message?: string, cause?: unknown) {
    super(message);
    this.name = 'AuthzError';
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthzVerificationError extends AuthzError {
  constructor(message?: string, cause?: unknown) {
    super(message, cause);
    this.name = 'AuthzVerificationError';
  }
}

export class AuthzAnonymousError extends AuthzError {
  constructor(message?: string, cause?: unknown) {
    super(message, cause);
    this.name = 'AuthzAnonymousError';
  }
}
