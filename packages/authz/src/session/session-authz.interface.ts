import { DEFAULT_PASSPORT_PROPERTY_VALUE } from '../constants';
import type { AuthzModuleBaseOptions } from '../utils';

export type ExtraSessionOptions = {
  /**
   * Option to keep session information after regenerating.
   */
  session?: {
    /**
     * Same as `passportjs` [keepSessionInfo](https://github.com/jaredhanson/passport/blob/217018dbc46dcd4118dd6f2c60c8d97010c587f8/CHANGELOG.md#L18).
     */
    keepSessionInfo?: boolean;
  };
};

export type SessionAuthzModuleOptions = Partial<AuthzModuleBaseOptions> & ExtraSessionOptions;

export const normalizedSessionAuthzModuleOptions = (options: Partial<SessionAuthzModuleOptions> = {}) => {
  const { keepSessionInfo } = options.session ?? {};

  return {
    defaultOverride: options.defaultOverride || false,
    passportProperty: options.passportProperty || DEFAULT_PASSPORT_PROPERTY_VALUE,
    skipFalsyMetadata: options.skipFalsyMetadata || false,
    defaultAllowAnonymous: options.defaultAllowAnonymous || false,
    keepSessionInfo
  };
};

export type SessionAuthzOptions = ReturnType<typeof normalizedSessionAuthzModuleOptions>;
