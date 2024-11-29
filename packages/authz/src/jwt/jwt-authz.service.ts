import { AsyncLocalStorage } from 'node:async_hooks';
import { Inject, mixin } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { AuthzProviderClass } from '../authz.provider';
import { JwtValidationType } from '../constants';
import { AuthzError } from '../errors';
import { type OmitClassInstance, encodeMsgpackrString, getAlsStore } from '../utils';
import type { JwtAlsType } from './jwt-authz-als.middleware';
import type { JwtAuthzOptions, RefreshPayload } from './jwt-authz.interface';

export const createJwtAuthzService = <P = unknown, U = unknown>([AUTHZ_PROVIDER, JWT_AUTHZ_OPTIONS, ALS_PROVIDER]: [
  any,
  any,
  any
]) => {
  class JwtAuthzService {
    constructor(
      @Inject(AUTHZ_PROVIDER)
      readonly authzProvider: AuthzProviderClass<P, U>,
      @Inject(JWT_AUTHZ_OPTIONS)
      readonly jwtAuthzOptions: JwtAuthzOptions,
      @Inject(ALS_PROVIDER)
      readonly als: AsyncLocalStorage<JwtAlsType<U>>
    ) {
      if (typeof this.authzProvider.createPayload !== 'function') {
        throw new AuthzError(
          `InternalError: Method 'createPayload' from abstract class 'AuthzProvider' must be implemented.`
        );
      }
      if (!jwtAuthzOptions.jwt?.sign) {
        throw new AuthzError(`InternalError: Missing JWT sign options.`);
      }
      if (this.jwtAuthzOptions.refresh && !this.jwtAuthzOptions.refresh.sign) {
        throw new AuthzError(`InternalError: Missing Refresh sign options.`);
      }
    }

    public async logIn(user: U) {
      const payload = (await this.authzProvider.createPayload(user)) as object;
      const token = jwt.sign(payload, this.jwtAuthzOptions.jwt!.secretOrPrivateKey!, this.jwtAuthzOptions.jwt!.sign);

      if (this.jwtAuthzOptions.refresh) {
        const refresh = jwt.sign(
          {
            data: encodeMsgpackrString(payload)
          } as RefreshPayload,
          this.jwtAuthzOptions.refresh.secretOrPrivateKey!,
          this.jwtAuthzOptions.refresh.sign
        );

        return {
          token,
          refresh
        };
      }

      return {
        token
      };
    }

    public async refresh(user?: U) {
      if (!this.jwtAuthzOptions.refresh) {
        console.warn(`'refresh' method can only be called when configured in module options.`);
        return undefined;
      }

      let userParams = user;

      if (!user) {
        const store = getAlsStore(this.als);

        if (store.jwtVerifiedBy !== JwtValidationType.REFRESH) {
          throw new AuthzError(
            `InvocationError: Calling 'refresh' method without user parameter can only be called under @Refresh().`
          );
        }

        userParams = store.user;
      }

      if (!userParams) {
        throw new AuthzError(`ParameterError: User data is undefined.`);
      }

      const payload = (await this.authzProvider.createPayload(userParams)) as object;
      const token = jwt.sign(payload, this.jwtAuthzOptions.jwt!.secretOrPrivateKey!, this.jwtAuthzOptions.jwt!.sign);

      return {
        token
      };
    }

    public setCookie(...rest: Parameters<JwtAlsType<unknown>['setCookie']>) {
      const store = getAlsStore(this.als);

      store.setCookie(...rest);
    }

    public getUser(): U | undefined {
      const store = getAlsStore(this.als);

      const user = store.user;

      return user;
    }
  }

  type Methods = 'als' | 'authzProvider' | 'jwtAuthzOptions';

  return mixin(JwtAuthzService as OmitClassInstance<typeof JwtAuthzService, Methods>);
};
