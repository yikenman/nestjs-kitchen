/**
 * Internal error type.
 */
export class MybatisMapperError extends Error {
  cause?: unknown;

  constructor(message?: string | Error, cause?: unknown) {
    super(typeof message === 'string' ? message : message?.message);
    this.name = 'MybatisMapperError';
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
