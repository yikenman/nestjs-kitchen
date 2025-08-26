import { type CanActivate, ExecutionContext, Injectable, type OnModuleInit, type Provider } from '@nestjs/common';
import { APP_GUARD, HttpAdapterHost } from '@nestjs/core';
import { AuthzError } from '../errors';
import { safeClone } from './safe-clone';

export type RawRequestWithShims = {
  shims: {
    getSession(key?: string): any;
    getAllSession(): any;
    setSession(key: string, value: any): void;
    deleteSession(key: string): void;
    sessionContains(key: string): boolean;
    regenerateSession(): Promise<void>;
    saveSession(): Promise<void>;
  };
  [key: string]: any;
};

export type RawResponseWithShims = {
  shims: {
    setCookie(key: string, value: string, options?: Record<string, any>): void;
  };
  [key: string]: any;
};

const addExpressShims = (req: any, res: any) => {
  const reqShims: RawRequestWithShims['shims'] = {
    getSession(key: string) {
      return req.session?.[key];
    },
    getAllSession() {
      return safeClone(req.session);
    },
    setSession(key: string, value: any) {
      req.session[key] = value;
    },
    deleteSession(key: string) {
      delete req.session?.[key];
    },
    sessionContains(key: string): boolean {
      if (!req.session) {
        return false;
      }
      return key in req.session;
    },
    async regenerateSession(): Promise<void> {
      return new Promise((resolve, reject) => {
        req.session.regenerate((err: any) => {
          if (err) return reject(err);
          resolve();
        });
      });
    },
    async saveSession(): Promise<void> {
      return new Promise((resolve, reject) => {
        req.session.save((err: any) => {
          if (err) return reject(err);
          resolve();
        });
      });
    }
  };

  const resShims: RawResponseWithShims['shims'] = {
    setCookie(key: string, value: string, options?: Record<string, any>) {
      res.cookie(key, value, options);
    }
  };

  req.shims = reqShims;
  res.shims = resShims;
};

const addFastifyShims = (req: any, res: any) => {
  const reqShims: RawRequestWithShims['shims'] = {
    getSession(key: string) {
      return req.session.get(key);
    },
    getAllSession() {
      const cloned = safeClone(req.session);
      // exclude cookie in @fastify/session
      if (req.session?.cookie?.constructor?.name === 'Cookie') {
        delete cloned.cookie;
      }
      // exclude built-in props in @fastify/secure-session
      if (req.session?.constructor?.name === 'Session') {
        delete cloned.changed;
        delete cloned.deleted;
      }

      return cloned;
    },
    setSession(key: string, value: any) {
      req.session.set(key, value);
    },
    deleteSession(key: string) {
      req.session[key] = undefined;
    },
    sessionContains(key: string): boolean {
      if (!req.session) {
        return false;
      }
      // fastify-session
      if (key in req.session) {
        return true;
      }
      // fastify-secure-session
      return req.session.get(key) !== undefined;
    },
    async regenerateSession(): Promise<void> {
      if (typeof req.session.save === 'function') {
        // fastify-session
        return req.session.regenerate();
      } else {
        // fastify-secure-session
        try {
          req.session.regenerate();
          return Promise.resolve();
        } catch (err) {
          return Promise.reject(err);
        }
      }
    },
    async saveSession(): Promise<void> {
      if (typeof req.session.save === 'function') {
        // fastify-session
        return req.session.save();
      } else {
        // fastify-secure-session does not have save method
        return Promise.resolve();
      }
    }
  };

  const resShims: RawResponseWithShims['shims'] = {
    setCookie(key: string, value: string, options?: Record<string, any>) {
      res.setCookie(key, value, options);
    }
  };

  req.raw.shims = reqShims;
  res.raw.shims = resShims;
};

const getShimsFactory = (adapter: string) => {
  switch (adapter) {
    case 'ExpressAdapter':
      return addExpressShims;
    case 'FastifyAdapter':
      return addFastifyShims;
  }

  throw new AuthzError(`Cannot find shims factory for adapter "${adapter}".`);
};

@Injectable()
export class AdapterShim implements CanActivate, OnModuleInit {
  private addShims: (req: any, res: any) => void;
  constructor(private httpAdapterHost: HttpAdapterHost) {}

  onModuleInit() {
    const adapter = this.httpAdapterHost?.httpAdapter?.constructor?.name;
    this.addShims = getShimsFactory(adapter);
  }

  canActivate(context: ExecutionContext) {
    this.addShims(context.switchToHttp().getRequest(), context.switchToHttp().getResponse());
    return true;
  }
}

let guardRegistered = false;

export const createOnceAdapterShimProvider = (): Provider[] => {
  if (guardRegistered) {
    return [];
  }
  guardRegistered = true;
  return [
    {
      provide: APP_GUARD,
      useClass: AdapterShim
    }
  ];
};
