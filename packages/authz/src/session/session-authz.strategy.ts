import { AsyncLocalStorage } from 'node:async_hooks';
import { Inject, mixin, type Type } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-custom';
import { AuthzProviderClass } from '../authz.provider';
import { PASSPORT_PROPERTY, SESSION_PASSPORT_KEY } from '../constants';
import { AuthzAnonymousError, AuthzError, AuthzVerificationError } from '../errors';
import { getAlsStore, type OmitClassInstance } from '../utils';
import type { SessionAlsType } from './session-authz-als.middleware';

export const createSessionAuthzStrategy = ([SESSION_STRATEGY, AUTHZ_PROVIDER, ALS_PROVIDER]: [string, any, any]) => {
  class SessionAuthzStrategy extends PassportStrategy(Strategy, SESSION_STRATEGY) {
    constructor(
      @Inject(AUTHZ_PROVIDER)
      readonly authzProvider: AuthzProviderClass<unknown, unknown>,
      @Inject(ALS_PROVIDER)
      readonly als: AsyncLocalStorage<SessionAlsType<unknown, unknown>>
    ) {
      super();

      if (typeof this.authzProvider.authenticate !== 'function') {
        throw new AuthzError(
          `InternalError: Method 'authenticate' from abstract class 'AuthzProvider' must be implemented.`
        );
      }
    }

    async validate(req: any) {
      const store = getAlsStore(this.als);
      const authOptions = store.authOptions;

      // @ts-ignore
      req[PASSPORT_PROPERTY] = authOptions.passportProperty;

      const payload = (req?.session as { [SESSION_PASSPORT_KEY]?: { user?: unknown } })?.[SESSION_PASSPORT_KEY]?.user;
      if (!payload) {
        return [null, new AuthzAnonymousError('AnonymousError: Cannnot find session.')];
      }

      let user: unknown = undefined;

      try {
        user = await this.authzProvider.authenticate(payload, req);
      } catch (error) {
        return [
          null,
          error instanceof Error
            ? new AuthzVerificationError(`${error.name}: ${error.message}`, error)
            : new AuthzVerificationError(`${error}`)
        ];
      }

      store.user = user;

      if (!user) {
        return [null, new AuthzAnonymousError('AnonymousError: Cannnot find user.')];
      }

      return user;
    }
  }

  type Methods = 'authzProvider' | 'als';

  return mixin(SessionAuthzStrategy as OmitClassInstance<typeof SessionAuthzStrategy, Methods>);
};
