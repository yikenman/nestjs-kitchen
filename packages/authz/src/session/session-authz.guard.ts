import { CanActivate, ExecutionContext, Inject, mixin, type Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AsyncLocalStorage } from 'async_hooks';
import { AuthzProviderClass } from '../authz.provider';
import { PASSPORT_PROPERTY, SESSION_PASSPORT_KEY } from '../constants';
import { AuthzAnonymousError, AuthzError, AuthzVerificationError } from '../errors';
import {
  type AuthzMetaParams,
  getAllowAnonymous,
  getAlsStore,
  getContextAuthzMetaParamsList,
  getPassportProperty,
  isNotFalsy,
  normalizedArray,
  type OmitClassInstance
} from '../utils';
import type { SessionAuthzOptions } from './session-authz.interface';
import type { SessionAlsType } from './session-authz-als.middleware';

export const createSessionAuthzGuard = ([AUTHZ_PROVIDER, SESSION_AUTHZ_OPTIONS, ALS_PROVIDER, SESSION_META_KEY]: [
  any,
  any,
  any,
  any
]) => {
  class SessionAuthzGuard implements CanActivate {
    constructor(
      readonly reflector: Reflector,
      @Inject(AUTHZ_PROVIDER)
      readonly authzProvider: AuthzProviderClass<unknown, unknown>,
      @Inject(SESSION_AUTHZ_OPTIONS)
      readonly sessionAuthzOptions: SessionAuthzOptions,
      @Inject(ALS_PROVIDER)
      readonly als: AsyncLocalStorage<SessionAlsType<unknown, unknown>>
    ) {
      if (typeof this.authzProvider.authenticate !== 'function') {
        throw new AuthzError(
          `InternalError: Method 'authenticate' from abstract class 'AuthzProvider' must be implemented.`
        );
      }
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

      const req = context.switchToHttp().getRequest();

      store.allowAnonymous = getAllowAnonymous(contextParamsList, {
        defaultAllowAnonymous: this.sessionAuthzOptions.defaultAllowAnonymous
      });

      req[this.sessionAuthzOptions.passportProperty] = this.handleRequest(undefined, ...(await this.validate(req)));

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

    async validate(req: any): Promise<[any, any?]> {
      const store = getAlsStore(this.als);
      const authOptions = this.sessionAuthzOptions;

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

      return [user];
    }
  }

  type Methods = 'reflector' | 'authzProvider' | 'sessionAuthzOptions' | 'als';

  return mixin(SessionAuthzGuard as OmitClassInstance<typeof SessionAuthzGuard, Methods>);
};
