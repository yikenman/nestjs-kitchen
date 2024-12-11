import { CanActivate, ExecutionContext, Inject, mixin } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { AsyncLocalStorage } from 'async_hooks';
import type { Request } from 'express';
import { AuthzProviderClass } from '../authz.provider';
import { AuthzAnonymousError, type AuthzError } from '../errors';
import {
  type AuthzMetaParams,
  type OmitClassInstance,
  getAllowAnonymous,
  getAlsStore,
  getContextAuthzMetaParamsList,
  getPassportProperty,
  isNotFalsy,
  normalizedArray
} from '../utils';
import type { SessionAlsType } from './session-authz-als.middleware';
import type { SessionAuthzOptions } from './session-authz.interface';

export const createSessionAuthzGuard = ([
  SESSION_STRATEGY,
  AUTHZ_PROVIDER,
  SESSION_AUTHZ_OPTIONS,
  ALS_PROVIDER,
  SESSION_META_KEY
]: [string, any, any, any, any]) => {
  class SessionAuthzGuard extends AuthGuard(SESSION_STRATEGY) implements CanActivate {
    constructor(
      readonly reflector: Reflector,
      @Inject(AUTHZ_PROVIDER)
      readonly authzProvider: AuthzProviderClass<unknown, unknown>,
      @Inject(SESSION_AUTHZ_OPTIONS)
      readonly sessionAuthzOptions: SessionAuthzOptions,
      @Inject(ALS_PROVIDER)
      readonly als: AsyncLocalStorage<SessionAlsType<unknown, unknown>>
    ) {
      super();
    }

    getAuthenticateOptions() {
      return {
        property: this.sessionAuthzOptions.passportProperty,
        session: false
      };
    }

    /**
     *
     * recives err, user, info from JwtStrategy.validate
     *
     * will return request.user=null if allowAnonymous=true
     *
     * @param _err will always be null
     * @param user if user is null, then info will be AuthError. if user is defined, then info will be undefined.
     * @param info AuthzError or undefined
     * @returns
     */
    handleRequest<T>(_err: unknown, user: T, info?: AuthzError) {
      const store = getAlsStore(this.als);

      if (info) {
        if (store.allowAnonymous && info.name === AuthzAnonymousError.name) {
          // user is null.
          return user;
        }
        store.guardResult = false;
        throw info;
      }

      return user;
    }

    async canActivate(context: ExecutionContext) {
      const store = getAlsStore(this.als);

      if (isNotFalsy(store.guardResult)) {
        return store.guardResult as boolean;
      }

      const paramsList = normalizedArray(
        this.reflector.getAll<AuthzMetaParams[]>(SESSION_META_KEY, [context.getClass(), context.getHandler()])
      );

      // bypass if last meta is public
      if (paramsList.length && Boolean(paramsList[paramsList.length - 1].options?.public)) {
        store.guardResult = true;
        return true;
      }

      const contextParamsList = getContextAuthzMetaParamsList(paramsList, {
        defaultOverride: this.sessionAuthzOptions.defaultOverride,
        skipFalsyMetadata: this.sessionAuthzOptions.skipFalsyMetadata
      });

      const req: Request = context.switchToHttp().getRequest();

      store.allowAnonymous = getAllowAnonymous(contextParamsList, {
        defaultAllowAnonymous: this.sessionAuthzOptions.defaultAllowAnonymous
      });

      await super.canActivate(context);

      // will be null if allowAnonymous=true.
      const user = getPassportProperty(req);
      if (store.allowAnonymous && !user) {
        return true;
      }

      for (const ele of contextParamsList) {
        if (!(await this.authzProvider.authorize(user, ele.metaData))) {
          return false;
        }
      }

      return true;
    }
  }

  type Methods = 'reflector' | 'authzProvider' | 'sessionAuthzOptions' | 'als';

  return mixin(SessionAuthzGuard as OmitClassInstance<typeof SessionAuthzGuard, Methods>);
};
