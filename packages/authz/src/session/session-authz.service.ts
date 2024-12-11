import { AsyncLocalStorage } from 'node:async_hooks';
import { Inject, mixin } from '@nestjs/common';
import { AuthzProviderClass } from '../authz.provider';
import { AuthzError } from '../errors';
import { type DeepReadonly, type OmitClassInstance, getAlsStore } from '../utils';
import type { SessionAlsType } from './session-authz-als.middleware';

export const createSessionAuthzService = <P = unknown, U = unknown>([AUTHZ_PROVIDER, ALS_PROVIDER]: [any, any]) => {
  class SessionAuthzService {
    constructor(
      @Inject(AUTHZ_PROVIDER)
      readonly authzProvider: AuthzProviderClass<P, U>,
      @Inject(ALS_PROVIDER)
      readonly als: AsyncLocalStorage<SessionAlsType<P, U>>
    ) {
      if (typeof this.authzProvider.createPayload !== 'function') {
        throw new AuthzError(
          `InternalError: Method 'createPayload' from abstract class 'AuthzProvider' must be implemented.`
        );
      }
    }

    /**
     * Creates a session id with a payload generated by AuthzProviderClass.createPayload().
     *
     * @param user - User entity
     */
    public async logIn(user: U) {
      const store = getAlsStore(this.als);

      const payload = await this.authzProvider.createPayload(user);

      return store.logIn(payload);
    }

    /**
     * Clears current user session.
     */
    public async logOut() {
      const store = getAlsStore(this.als);

      return store.logOut();
    }

    /**
     * Sets a secure HTTP cookie with the given name, value, and optional cookie options.
     */
    public setCookie(...rest: Parameters<SessionAlsType<U, P>['setCookie']>) {
      const store = getAlsStore(this.als);

      store.setCookie(...rest);
    }

    /**
     * Retrieves the current user associated with the request, if available.
     */
    public getUser(): DeepReadonly<U> | undefined {
      const store = getAlsStore(this.als);

      const user = store.user;

      return user;
    }
  }

  type Methods = 'als' | 'authzProvider';

  return mixin(SessionAuthzService as OmitClassInstance<typeof SessionAuthzService, Methods>);
};
