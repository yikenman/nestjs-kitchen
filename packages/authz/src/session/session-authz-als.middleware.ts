import { AsyncLocalStorage } from 'node:async_hooks';
import { Inject, mixin, NestMiddleware, type Type } from '@nestjs/common';
import { SESSION_PASSPORT_KEY } from '../constants';
import {
  createSetCookieFn,
  type OmitClassInstance,
  type RawRequestWithShims,
  type RawResponseWithShims
} from '../utils';
import type { SessionAuthzOptions } from './session-authz.interface';

export interface SessionAlsType<P, U> {
  user?: U;
  allowAnonymous?: boolean;
  guardResult?: boolean;
  logIn: (user: P) => Promise<void>;
  logOut: () => Promise<void>;
  setCookie: (name: string, value: string, options?: Record<string, any>) => void;
}

export const createSessionAuthzAlsMiddleware = ([ALS_PROVIDER, SESSION_AUTHZ_OPTIONS]: [any, any]) => {
  class SessionAuthzAlsMiddleware implements NestMiddleware {
    constructor(
      @Inject(ALS_PROVIDER)
      readonly als: AsyncLocalStorage<SessionAlsType<unknown, unknown>>,
      @Inject(SESSION_AUTHZ_OPTIONS)
      readonly sessionAuthzOptions: SessionAuthzOptions
    ) {}

    use(req: RawRequestWithShims, res: RawResponseWithShims, next: Function) {
      const keepSessionInfo = Boolean(this.sessionAuthzOptions.keepSessionInfo);

      const store: SessionAlsType<unknown, unknown> = {
        user: undefined,
        allowAnonymous: undefined,
        guardResult: undefined,
        // ref: https://github.com/jaredhanson/passport/blob/217018dbc46dcd4118dd6f2c60c8d97010c587f8/lib/sessionmanager.js#L14
        logIn: async <T>(user: T) => {
          const prevSession = req.shims.getAllSession();

          await req.shims.regenerateSession();

          if (keepSessionInfo) {
            for (const key in prevSession) {
              if (req.shims.sessionContains(key)) {
                req.shims.setSession(key, prevSession[key]);
              }
            }
          }

          const passportSession = req.shims.getSession(SESSION_PASSPORT_KEY) ?? {};
          passportSession.user = user;
          req.shims.setSession(SESSION_PASSPORT_KEY, passportSession);

          await req.shims.saveSession();

          return;
        },
        // ref: https://github.com/jaredhanson/passport/blob/217018dbc46dcd4118dd6f2c60c8d97010c587f8/lib/sessionmanager.js#L57
        logOut: async () => {
          if (req.shims.sessionContains(SESSION_PASSPORT_KEY)) {
            const passportSession = req.shims.getSession(SESSION_PASSPORT_KEY)!;
            delete passportSession.user;
            req.shims.setSession(SESSION_PASSPORT_KEY, passportSession);
          }

          const prevSession = req.shims.getAllSession();

          await req.shims.saveSession();

          await req.shims.regenerateSession();

          if (keepSessionInfo) {
            for (const key in prevSession) {
              if (req.shims.sessionContains(key)) {
                req.shims.setSession(key, prevSession[key]);
              }
            }
          }
        },
        setCookie: createSetCookieFn(req, res)
      };

      this.als.run(store, () => {
        next();
      });
    }
  }

  type Methods = 'als' | 'sessionAuthzOptions';

  return mixin(SessionAuthzAlsMiddleware as OmitClassInstance<typeof SessionAuthzAlsMiddleware, Methods>);
};
