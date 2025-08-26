import { AsyncLocalStorage } from 'node:async_hooks';
import { Inject, mixin, NestMiddleware, type Type } from '@nestjs/common';
import { JwtValidationType } from '../constants';
import {
  createSetCookieFn,
  type OmitClassInstance,
  type RawRequestWithShims,
  type RawResponseWithShims
} from '../utils';
import type { JwtAuthzOptions } from './jwt-authz.interface';

export interface JwtAlsType<U> {
  user?: U;
  jwtVerifiedBy?: JwtValidationType;
  allowAnonymous?: boolean;
  guardResult?: boolean;
  authOptions: JwtAuthzOptions;
  setCookie: (name: string, value: string, options?: Record<string, any>) => void;
}

export const createJwtAuthzAlsMiddleware = ([ALS_PROVIDER, JWT_AUTHZ_OPTIONS]: [any, any]) => {
  class JwtAuthzAlsMiddleware implements NestMiddleware {
    constructor(
      @Inject(ALS_PROVIDER)
      readonly als: AsyncLocalStorage<JwtAlsType<unknown>>,
      @Inject(JWT_AUTHZ_OPTIONS)
      readonly jwtAuthzOptions: JwtAuthzOptions
    ) {}

    use(req: RawRequestWithShims, res: RawResponseWithShims, next: Function) {
      const store: JwtAlsType<unknown> = {
        user: undefined,
        jwtVerifiedBy: undefined,
        allowAnonymous: undefined,
        guardResult: undefined,
        // a workaround to pass jwtAuthzOptions to passport strategy.
        authOptions: this.jwtAuthzOptions,
        setCookie: createSetCookieFn(req, res)
      };

      this.als.run(store, () => {
        next();
      });
    }
  }

  type Methods = 'als' | 'jwtAuthzOptions';

  return mixin(JwtAuthzAlsMiddleware as OmitClassInstance<typeof JwtAuthzAlsMiddleware, Methods>);
};
