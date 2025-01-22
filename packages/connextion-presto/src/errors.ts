import { ConnextionError } from '@nestjs-kitchen/connextion';

/**
 * Internal error type.
 */
export class PrestoError extends ConnextionError {
  cause?: unknown;

  constructor(message?: string | Error, cause?: unknown) {
    super(typeof message === 'string' ? message : message?.message);
    this.name = 'PrestoError';
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
