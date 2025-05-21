import type { Options } from 'csrf';

export type HttpMethod = 'GET' | 'HEAD' | 'PATCH' | 'PUT' | 'POST' | 'DELETE' | 'CONNECT' | 'OPTIONS' | 'TRACE' | {};

export type CsrfOptions = Options & {
  /**
   * A sync function to retrieve the CSRF token from the request.
   *
   * Default:
   * ```ts
   * getToken(req) {
   *   return req.headers['x-csrf-token'];
   * }
   * ```
   */
  getToken?: (req: any) => string;
  /**
   * Response header name to expose the CSRF token.
   *
   * Default: 'x-csrf-token'
   */
  headerKey?: string;
  /**
   * HTTP methods that require CSRF verification.
   *
   * Default: ['PATCH', 'PUT', 'POST', 'DELETE', 'CONNECT', 'TRACE']
   */
  verifyMethods?: HttpMethod[];
  verifyMethodsSet?: Set<string>;
};

export type CsrfDoubleCsrfOptions = {
  /**
   * CSRF protection strategy.
   *
   * Default: `'double-csrf'`
   *
   * - `'double-csrf'`: Stores the CSRF secret/token exclusively in a cookie. Requires cookie middleware/plugin.
   * - `'session'`: Stores the CSRF secret in the session. Optionally supports one-time-use tokens. Requires session middleware/plugin.
   */
  type?: 'double-csrf';
  /**
   * Cookie name to store the CSRF secret.
   *
   * Default: '_csrf'
   */
  cookieKey?: string;
  /**
   * The cookie serialization options.
   */
  cookieOptions?: {
    /**
     * Default: '/'
     */
    path?: string;
    /**
     * Default: false
     */
    secure?: boolean;
    /**
     * Default: 'strict'
     */
    sameSite?: string;
    /**
     * Default: true
     */
    httpOnly?: boolean;
    /**
     * Default: false
     */
    signed?: boolean;
    /**
     * Default: undefined
     */
    maxAge?: number;
    [key: string]: any;
  };
};

export type CsrfSessionOptions = {
  /**
   * CSRF protection strategy.
   *
   * Default: `'double-csrf'`
   *
   * - `'double-csrf'`: Stores the CSRF secret/token exclusively in a cookie. Requires cookie middleware/plugin.
   * - `'session'`: Stores the CSRF secret in the session. Optionally supports one-time-use tokens. Requires session middleware/plugin.
   */
  type?: 'session';
  /**
   * Session key to store the CSRF secret.
   *
   * Default: '_csrf'
   */
  sessionKey?: string;
  /**
   * Enables one-time-use CSRF tokens.
   * When enabled, each generated token is valid for a single verification only.
   *
   * Default: false
   */
  oneTimeToken?: boolean;
  /**
   * Time-to-live (in milliseconds) for one-time tokens.
   * After expiration, the token becomes invalid.
   *
   * Default: undefined
   */
  oneTimeTokenTTL?: number;
  /**
   * Store for one-time tokens. Uses in-memory store by default.
   */
  nonceStore?: {
    get: (key: string) => Promise<any> | any;
    set: (key: string, value: string, ttl?: number) => Promise<void> | void;
    del: (key: string) => Promise<void> | void;
  };
};

export type CsrfModuleOptions = Omit<CsrfOptions, 'verifyMethodsSet'> & (CsrfDoubleCsrfOptions | CsrfSessionOptions);
