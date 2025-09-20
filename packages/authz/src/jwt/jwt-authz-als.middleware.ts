import { AsyncLocalStorage } from 'node:async_hooks';
import { Inject, mixin, NestMiddleware, type Type } from '@nestjs/common';
import { JwtValidationType } from '../constants';
import {
  createSetCookieFn,
  type OmitClassInstance,
  type RawRequestWithShims,
  type RawResponseWithShims
} from '../utils';

export interface JwtAlsType<U> {
  user?: U;
  jwtVerifiedBy?: JwtValidationType;
  allowAnonymous?: boolean;
  guardResult?: boolean;
  setCookie: (name: string, value: string, options?: Record<string, any>) => void;
}

export const createJwtAuthzAlsMiddleware = ([ALS_PROVIDER]: [any]) => {
  class JwtAuthzAlsMiddleware implements NestMiddleware {
    constructor(
      @Inject(ALS_PROVIDER)
      readonly als: AsyncLocalStorage<JwtAlsType<unknown>>
    ) {}

    use(req: RawRequestWithShims, res: RawResponseWithShims, next: Function) {
      const store: JwtAlsType<unknown> = {
        user: undefined,
        jwtVerifiedBy: undefined,
        allowAnonymous: undefined,
        guardResult: undefined,
        setCookie: createSetCookieFn(req, res)
      };

      this.als.run(store, () => {
        next();
      });
    }
  }

  type Methods = 'als';

  return mixin(JwtAuthzAlsMiddleware as OmitClassInstance<typeof JwtAuthzAlsMiddleware, Methods>);
};
