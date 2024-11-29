import type { SessionOptions } from 'express-session';
import { DEFAULT_PASSPORT_PROPERTY_VALUE } from '../constants';
import type { AuthzModuleBaseOptions } from '../utils';

export type SessionAuthzModuleOptions = Partial<AuthzModuleBaseOptions> & {
  session: SessionOptions & {
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
