import { AsyncLocalStorage } from 'node:async_hooks';
import { Inject, mixin, NestMiddleware, type Type } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { SESSION_PASSPORT_KEY } from '../constants';
import { AuthzError } from '../errors';
import { type CookieOptionsWithSecret, createSetCookieFn, merge, type OmitClassInstance } from '../utils';
import type { SessionAuthzOptions } from './session-authz.interface';

export interface SessionAlsType<P, U> {
  user?: U;
  allowAnonymous?: boolean;
  guardResult?: boolean;
  authOptions: SessionAuthzOptions;
  logIn: (user: P) => Promise<void>;
  logOut: () => Promise<void>;
  setCookie: (name: string, value: string, options?: CookieOptionsWithSecret) => void;
}

export const createSessionAuthzAlsMiddleware = ([ALS_PROVIDER, SESSION_AUTHZ_OPTIONS]: [any, any]) => {
  class SessionAuthzAlsMiddleware implements NestMiddleware {
    constructor(
      @Inject(ALS_PROVIDER)
      readonly als: AsyncLocalStorage<SessionAlsType<unknown, unknown>>,
      @Inject(SESSION_AUTHZ_OPTIONS)
      readonly sessionAuthzOptions: SessionAuthzOptions
    ) {}

    use(req: Request, res: Response, next: NextFunction) {
      const keepSessionInfo = Boolean(this.sessionAuthzOptions.keepSessionInfo);

      if (!req.session) {
        return next(
          new AuthzError('Login sessions require session support. Did you forget to use `express-session` middleware?')
        );
      }

      const prevSession = req.session;

      const store = {
        user: undefined,
        allowAnonymous: undefined,
        guardResult: undefined,
        authOptions: this.sessionAuthzOptions,
        // ref: https://github.com/jaredhanson/passport/blob/217018dbc46dcd4118dd6f2c60c8d97010c587f8/lib/sessionmanager.js#L14
        logIn: <T>(user: T) => {
          return new Promise<void>((resolve, reject) => {
            req.session.regenerate(function (err) {
              if (err) {
                return reject(err);
              }

              if (keepSessionInfo) {
                merge(req.session, prevSession);
              }

              // @ts-ignore
              if (!req.session[SESSION_PASSPORT_KEY]) {
                // @ts-ignore
                req.session[SESSION_PASSPORT_KEY] = {};
              }
              // @ts-ignore
              req.session[SESSION_PASSPORT_KEY].user = user;

              req.session.save(function (err) {
                if (err) {
                  return reject(err);
                }
                resolve();
              });
            });
          });
        },
        // ref: https://github.com/jaredhanson/passport/blob/217018dbc46dcd4118dd6f2c60c8d97010c587f8/lib/sessionmanager.js#L57
        logOut: () => {
          return new Promise<void>((resolve, reject) => {
            // @ts-ignore
            if (req.session[SESSION_PASSPORT_KEY]) {
              // @ts-ignore
              delete req.session[SESSION_PASSPORT_KEY].user;
            }

            req.session.save(function (err) {
              if (err) {
                return reject(err);
              }

              req.session.regenerate(function (err) {
                if (err) {
                  return reject(err);
                }
                if (keepSessionInfo) {
                  merge(req.session, prevSession);
                }
                resolve();
              });
            });
          });
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
