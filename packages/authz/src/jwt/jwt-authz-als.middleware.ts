import { AsyncLocalStorage } from 'node:async_hooks';
import { Inject, NestMiddleware, type Type, mixin } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { JwtValidationType } from '../constants';
import { type CookieOptionsWithSecret, type OmitClassInstance, createSetCookieFn } from '../utils';
import type { JwtAuthzOptions } from './jwt-authz.interface';

export interface JwtAlsType<U> {
  user?: U;
  jwtVerifiedBy?: JwtValidationType;
  allowAnonymous?: boolean;
  guardResult?: boolean;
  authOptions: JwtAuthzOptions;
  setCookie: (name: string, value: string, options?: CookieOptionsWithSecret) => void;
}

export const createJwtAuthzAlsMiddleware = ([ALS_PROVIDER, JWT_AUTHZ_OPTIONS]: [any, any]) => {
  class JwtAuthzAlsMiddleware implements NestMiddleware {
    constructor(
      @Inject(ALS_PROVIDER)
      readonly als: AsyncLocalStorage<JwtAlsType<unknown>>,
      @Inject(JWT_AUTHZ_OPTIONS)
      readonly jwtAuthzOptions: JwtAuthzOptions
    ) {}

    use(req: Request, res: Response, next: NextFunction) {
      this.als.run(
        {
          user: undefined,
          jwtVerifiedBy: undefined,
          allowAnonymous: undefined,
          guardResult: undefined,
          // a workaround to pass jwtAuthzOptions to passport strategy.
          authOptions: this.jwtAuthzOptions,
          setCookie: createSetCookieFn(req, res)
        },
        () => {
          next();
        }
      );
    }
  }

  type Methods = 'als' | 'jwtAuthzOptions';

  return mixin(JwtAuthzAlsMiddleware as OmitClassInstance<typeof JwtAuthzAlsMiddleware, Methods>);
};
