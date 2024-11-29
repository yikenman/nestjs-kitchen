import { AsyncLocalStorage } from 'node:async_hooks';
import { Inject, mixin } from '@nestjs/common';
import { AuthzProviderClass } from '../authz.provider';
import { AuthzError } from '../errors';
import { type OmitClassInstance, getAlsStore } from '../utils';
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

    public async logIn(user: U) {
      const store = getAlsStore(this.als);

      const payload = await this.authzProvider.createPayload(user);

      return store.logIn(payload);
    }

    public async logOut() {
      const store = getAlsStore(this.als);

      return store.logOut();
    }

    public setCookie(...rest: Parameters<SessionAlsType<U, P>['setCookie']>) {
      const store = getAlsStore(this.als);

      store.setCookie(...rest);
    }

    public getUser(): U | undefined {
      const store = getAlsStore(this.als);

      const user = store.user;

      return user;
    }
  }

  type Methods = 'als' | 'authzProvider';

  return mixin(SessionAuthzService as OmitClassInstance<typeof SessionAuthzService, Methods>);
};
