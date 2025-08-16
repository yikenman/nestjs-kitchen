import type { AsyncLocalStorage } from 'node:async_hooks';
import { CanActivate, ExecutionContext, Inject, mixin, type Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { AuthzProviderClass } from '../authz.provider';
import { AuthzAnonymousError, type AuthzError } from '../errors';
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
import type { JwtAuthzOptions } from './jwt-authz.interface';
import type { JwtAlsType } from './jwt-authz-als.middleware';

export const createJwtAuthzGuard = ([
  JWT_STRATEGY,
  AUTHZ_PROVIDER,
  JWT_AUTHZ_OPTIONS,
  ALS_PROVIDER,
  JWT_META_KEY,
  JWT_REFRESH_META_KEY
]: [string, any, any, any, any, any]) => {
  class JwtAuthzGuard extends AuthGuard(JWT_STRATEGY) implements CanActivate {
    constructor(
      readonly reflector: Reflector,
      @Inject(AUTHZ_PROVIDER)
      readonly authzProvider: AuthzProviderClass<unknown, unknown>,
      @Inject(JWT_AUTHZ_OPTIONS)
      readonly jwtAuthzOptions: JwtAuthzOptions,
      @Inject(ALS_PROVIDER)
      readonly als: AsyncLocalStorage<JwtAlsType<unknown>>
    ) {
      super();
    }

    getAuthenticateOptions() {
      return {
        property: this.jwtAuthzOptions.passportProperty,
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

      const jwtRefreshMetaCollection = normalizedArray(
        this.reflector.getAll<boolean[]>(JWT_REFRESH_META_KEY, [context.getClass(), context.getHandler()])
      );

      // authz decorator will be ignore when use refresh decorator together.
      if (Boolean(this.jwtAuthzOptions.refresh) && jwtRefreshMetaCollection.length) {
        store.guardResult = true;
        return true;
      }

      const paramsList = normalizedArray(
        this.reflector.getAll<AuthzMetaParams[]>(JWT_META_KEY, [context.getClass(), context.getHandler()])
      );

      // bypass if last meta is public
      if (paramsList.length && Boolean(paramsList[paramsList.length - 1].options?.public)) {
        store.guardResult = true;
        return true;
      }

      const contextParamsList = getContextAuthzMetaParamsList(paramsList, {
        defaultOverride: this.jwtAuthzOptions.defaultOverride,
        skipFalsyMetadata: this.jwtAuthzOptions.skipFalsyMetadata
      });

      const req: Request = context.switchToHttp().getRequest();

      store.allowAnonymous = getAllowAnonymous(contextParamsList, {
        defaultAllowAnonymous: this.jwtAuthzOptions.defaultAllowAnonymous
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

  type Methods = 'reflector' | 'authzProvider' | 'jwtAuthzOptions' | 'als';

  return mixin(JwtAuthzGuard as OmitClassInstance<typeof JwtAuthzGuard, Methods>);
};

export const createJwtRefreshAuthzGuard = ([JWT_REFRESH_STRATEGY, JWT_AUTHZ_OPTIONS]: [string, any]) => {
  class JwtRefreshAuthzGuard extends AuthGuard(JWT_REFRESH_STRATEGY) implements CanActivate {
    constructor(
      @Inject(JWT_AUTHZ_OPTIONS)
      readonly jwtAuthzOptions: JwtAuthzOptions
    ) {
      super();
    }

    getAuthenticateOptions() {
      return {
        property: this.jwtAuthzOptions.passportProperty,
        session: false
      };
    }

    handleRequest<T>(_err: unknown, user: T, info?: AuthzError) {
      if (info) {
        throw info;
      }

      return user;
    }
  }

  type Methods = 'jwtAuthzOptions';

  return mixin(JwtRefreshAuthzGuard as OmitClassInstance<typeof JwtRefreshAuthzGuard, Methods>);
};
