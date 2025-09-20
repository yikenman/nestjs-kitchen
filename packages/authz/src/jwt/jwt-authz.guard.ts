import type { AsyncLocalStorage } from 'node:async_hooks';
import { CanActivate, ExecutionContext, Inject, mixin, type Type } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import jwt from 'jsonwebtoken';
import { AuthzProviderClass } from '../authz.provider';
import { JwtValidationType, PASSPORT_PROPERTY } from '../constants';
import { AuthzAnonymousError, AuthzError, AuthzVerificationError } from '../errors';
import {
  type AuthzMetaParams,
  decodeMsgpackrString,
  getAllowAnonymous,
  getAlsStore,
  getContextAuthzMetaParamsList,
  getPassportProperty,
  isNotFalsy,
  normalizedArray,
  type OmitClassInstance,
  type SetRequired
} from '../utils';
import { ExtractJwt } from './extract-jwt';
import type { JwtAuthzOptions, RefreshPayload } from './jwt-authz.interface';
import type { JwtAlsType } from './jwt-authz-als.middleware';

export const createJwtAuthzGuard = ([
  AUTHZ_PROVIDER,
  JWT_AUTHZ_OPTIONS,
  ALS_PROVIDER,
  JWT_META_KEY,
  JWT_REFRESH_META_KEY
]: [any, any, any, any, any]) => {
  class JwtAuthzGuard implements CanActivate {
    constructor(
      readonly reflector: Reflector,
      @Inject(AUTHZ_PROVIDER)
      readonly authzProvider: AuthzProviderClass<unknown, unknown>,
      @Inject(JWT_AUTHZ_OPTIONS)
      readonly jwtAuthzOptions: JwtAuthzOptions,
      @Inject(ALS_PROVIDER)
      readonly als: AsyncLocalStorage<JwtAlsType<unknown>>
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

      const req = context.switchToHttp().getRequest();

      store.allowAnonymous = getAllowAnonymous(contextParamsList, {
        defaultAllowAnonymous: this.jwtAuthzOptions.defaultAllowAnonymous
      });

      req[this.jwtAuthzOptions.passportProperty] = this.handleRequest(undefined, ...(await this.validate(req)));

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
      const authOptions = this.jwtAuthzOptions;

      if (!authOptions.jwt.verify) {
        return [null, new AuthzError(`InternalError: Refresh verify options must be implemented.`)];
      }

      const extractor = ExtractJwt.fromExtractors(authOptions.jwt.jwtFromRequest);
      req[PASSPORT_PROPERTY] = authOptions.passportProperty;

      const token: string | null = extractor(req);
      if (!token) {
        return [null, new AuthzAnonymousError('AnonymousError: Cannnot find token.')];
      }

      let user: unknown = undefined;

      try {
        const payload = jwt.verify(token, authOptions.jwt.secretOrPublicKey!, authOptions.jwt.verify);
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
      store.jwtVerifiedBy = JwtValidationType.JWT;

      if (!user) {
        return [null, new AuthzAnonymousError('AnonymousError: Cannnot find user.')];
      }

      return [user];
    }
  }

  type Methods = 'reflector' | 'authzProvider' | 'jwtAuthzOptions' | 'als';

  return mixin(JwtAuthzGuard as OmitClassInstance<typeof JwtAuthzGuard, Methods>);
};

export const createJwtRefreshAuthzGuard = ([JWT_AUTHZ_OPTIONS, AUTHZ_PROVIDER, ALS_PROVIDER]: [any, any, any]) => {
  class JwtRefreshAuthzGuard implements CanActivate {
    constructor(
      @Inject(JWT_AUTHZ_OPTIONS)
      readonly jwtAuthzOptions: JwtAuthzOptions,
      @Inject(AUTHZ_PROVIDER)
      readonly authzProvider: AuthzProviderClass<unknown, unknown>,
      @Inject(ALS_PROVIDER)
      readonly als: AsyncLocalStorage<JwtAlsType<unknown>>
    ) {
      if (typeof this.authzProvider.authenticate !== 'function') {
        throw new AuthzError(
          `InternalError: Method 'authenticate' from abstract class 'AuthzProvider' must be implemented.`
        );
      }
    }

    handleRequest<T>(_err: unknown, user: T, info?: AuthzError) {
      if (info) {
        throw info;
      }

      return user;
    }

    async canActivate(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest();

      req[this.jwtAuthzOptions.passportProperty] = this.handleRequest(undefined, ...(await this.validate(req)));

      return true;
    }

    async validate(req: any): Promise<[any, any?]> {
      const store = getAlsStore(this.als);
      const authOptions = this.jwtAuthzOptions as SetRequired<JwtAuthzOptions, 'refresh'>;

      if (!authOptions.refresh.verify) {
        return [null, new AuthzError(`InternalError: Refresh verify options must be implemented.`)];
      }

      const extractor = ExtractJwt.fromExtractors(authOptions.refresh.jwtFromRequest);
      req[PASSPORT_PROPERTY] = authOptions.passportProperty;

      const token: string | null = extractor(req);
      if (!token) {
        return [null, new AuthzAnonymousError('AnonymousError: Cannnot find token.')];
      }

      let user: unknown = undefined;

      try {
        const payload = jwt.verify(
          token,
          authOptions.refresh.secretOrPublicKey!,
          authOptions.refresh.verify
        ) as RefreshPayload;

        const decodePayload = decodeMsgpackrString(payload.data);

        user = await this.authzProvider.authenticate(decodePayload, req);
      } catch (error) {
        return [
          null,
          error instanceof Error
            ? new AuthzVerificationError(`${error.name}: ${error.message}`, error)
            : new AuthzVerificationError(`${error}`)
        ];
      }

      store.user = user;
      store.jwtVerifiedBy = JwtValidationType.REFRESH;

      if (!user) {
        return [null, new AuthzAnonymousError('AnonymousError: Cannnot find user.')];
      }

      return [user];
    }
  }

  type Methods = 'jwtAuthzOptions' | 'authzProvider' | 'als';

  return mixin(JwtRefreshAuthzGuard as OmitClassInstance<typeof JwtRefreshAuthzGuard, Methods>);
};
