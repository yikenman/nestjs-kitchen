import session from 'express-session';
import { DEFAULT_PASSPORT_PROPERTY_VALUE } from '../constants';
import type { AuthzModuleBaseOptions } from '../utils';

export type SessionOptions = Parameters<typeof session>[0];

export type SessionAuthzModuleOptions = Partial<AuthzModuleBaseOptions> & {
  /**
   * Session options.
   *
   * Same as `express-session` [session options](https://www.npmjs.com/package/express-session#options).
   */
  session: SessionOptions & {
    /**
     * Option to keep session information after regenerating.
     *
     * Same as `passportjs` [keepSessionInfo](https://github.com/jaredhanson/passport/blob/217018dbc46dcd4118dd6f2c60c8d97010c587f8/CHANGELOG.md#L18).
     */
    keepSessionInfo?: boolean;
  };
};

export const normalizedSessionAuthzModuleOptions = (options: Partial<SessionAuthzModuleOptions> = {}) => {
  const { keepSessionInfo, ...sessionOpts } = options.session ?? {};

  return {
    defaultOverride: options.defaultOverride || false,
    passportProperty: options.passportProperty || DEFAULT_PASSPORT_PROPERTY_VALUE,
    skipFalsyMetadata: options.skipFalsyMetadata || false,
    defaultAllowAnonymous: options.defaultAllowAnonymous || false,
    keepSessionInfo,
    session: {
      resave: false,
      saveUninitialized: false,
      ...sessionOpts
    } as SessionOptions
  };
};

export type SessionAuthzOptions = ReturnType<typeof normalizedSessionAuthzModuleOptions>;
