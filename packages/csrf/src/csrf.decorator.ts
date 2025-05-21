import { type CustomDecorator, SetMetadata } from '@nestjs/common';
import { CSRF_METADATA_NO_VERIFY, CSRF_METADATA_SIGN, CSRF_METADATA_VERIFY } from './constants';

export interface Csrf {
  /**
   * Enables CSRF check for this route, even if the method is not in `options.verifyMethods`.
   */
  (): CustomDecorator<string>;
  /**
   * Disables CSRF check for this route.
   */
  NoVerify(): CustomDecorator<string>;
  /**
   * Always generates a new CSRF token and updates the cookie/session.
   *
   * This will also disables CSRF check for the route.
   */
  Sign(): CustomDecorator<string>;
}

export const Csrf: Csrf = () => {
  return SetMetadata(CSRF_METADATA_VERIFY, true);
};

Csrf.NoVerify = () => {
  return SetMetadata(CSRF_METADATA_NO_VERIFY, true);
};

Csrf.Sign = () => {
  return SetMetadata(CSRF_METADATA_SIGN, true);
};
