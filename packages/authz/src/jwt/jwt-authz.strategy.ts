import { AsyncLocalStorage } from 'node:async_hooks';
import { Inject, Injectable, mixin } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import jwt from 'jsonwebtoken';
import { Strategy } from 'passport-custom';
import { AuthzProviderClass } from '../authz.provider';
import { JwtValidationType, PASSPORT_PROPERTY } from '../constants';
import { AuthzAnonymousError, AuthzError, AuthzVerificationError } from '../errors';
import { type OmitClassInstance, type SetRequired, decodeMsgpackrString, getAlsStore } from '../utils';
import { ExtractJwt } from './extract-jwt';
import type { JwtAlsType } from './jwt-authz-als.middleware';
import type { JwtAuthzOptions, RefreshPayload } from './jwt-authz.interface';

export const createJwtStrategy = ([JWT_STRATEGY, AUTHZ_PROVIDER, ALS_PROVIDER]: [string, any, any]) => {
  class JwtStrategy extends PassportStrategy(Strategy, JWT_STRATEGY) {
    constructor(
      @Inject(AUTHZ_PROVIDER)
      readonly authzProvider: AuthzProviderClass<unknown, unknown>,
      @Inject(ALS_PROVIDER)
      readonly als: AsyncLocalStorage<JwtAlsType<unknown>>
    ) {
      super();

      if (typeof this.authzProvider.authenticate !== 'function') {
        throw new AuthzError(
          `InternalError: Method 'authenticate' from abstract class 'AuthzProvider' must be implemented.`
        );
      }
    }

    async validate(req: Request) {
      const store = getAlsStore(this.als);
      const authOptions = store.authOptions;

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

      return user;
    }
  }

  type Methods = 'authzProvider' | 'als';
  return mixin(JwtStrategy as OmitClassInstance<typeof JwtStrategy, Methods>);
};

export const createRefreshStrategy = ([JWT_REFRESH_STRATEGY, AUTHZ_PROVIDER, ALS_PROVIDER]: [string, any, any]) => {
  @Injectable()
  class RefreshStrategy extends PassportStrategy(Strategy, JWT_REFRESH_STRATEGY) {
    constructor(
      @Inject(AUTHZ_PROVIDER)
      readonly authzProvider: AuthzProviderClass<unknown, unknown>,
      @Inject(ALS_PROVIDER)
      readonly als: AsyncLocalStorage<JwtAlsType<unknown>>
    ) {
      super();

      if (typeof this.authzProvider.authenticate !== 'function') {
        throw new AuthzError(
          `InternalError: Method 'authenticate' from abstract class 'AuthzProvider' must be implemented.`
        );
      }
    }

    async validate(req: Request) {
      const store = getAlsStore(this.als);
      const authOptions = store.authOptions as SetRequired<JwtAuthzOptions, 'refresh'>;

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

      return user;
    }
  }

  type Methods = 'authzProvider' | 'als';
  return mixin(RefreshStrategy as OmitClassInstance<typeof RefreshStrategy, Methods>);
};
