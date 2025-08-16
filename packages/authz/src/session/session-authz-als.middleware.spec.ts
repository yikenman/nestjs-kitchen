import { AsyncLocalStorage } from 'node:async_hooks';
import { mixin } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import { SESSION_PASSPORT_KEY } from '../constants';
import { AuthzError } from '../errors';
import { createSetCookieFn, merge } from '../utils';
import type { SessionAuthzOptions } from './session-authz.interface';
import { createSessionAuthzAlsMiddleware, type SessionAlsType } from './session-authz-als.middleware';

jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');

  return {
    ...actual,
    mixin: jest.fn(actual.mixin)
  };
});

jest.mock('../utils', () => {
  const actual = jest.requireActual('../utils');

  return {
    ...actual,
    merge: jest.fn(actual.merge),
    createSetCookieFn: jest.fn(actual.createSetCookieFn)
  };
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('Session Authz ALS Middleware', () => {
  const ALS_PROVIDER = 'ALS_PROVIDER';
  const SESSION_AUTHZ_OPTIONS = 'SESSION_AUTHZ_OPTIONS';

  let middleware: InstanceType<ReturnType<typeof createSessionAuthzAlsMiddleware>>;
  let als: AsyncLocalStorage<SessionAlsType<unknown, unknown>>;
  let sessionAuthzOptions: SessionAuthzOptions;

  beforeEach(async () => {
    als = new AsyncLocalStorage();
    sessionAuthzOptions = {
      keepSessionInfo: false
    } as SessionAuthzOptions;

    const SessionAuthzAlsMiddleware = createSessionAuthzAlsMiddleware([ALS_PROVIDER, SESSION_AUTHZ_OPTIONS]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionAuthzAlsMiddleware,
        { provide: ALS_PROVIDER, useValue: als },
        { provide: SESSION_AUTHZ_OPTIONS, useValue: sessionAuthzOptions }
      ]
    }).compile();

    middleware = module.get<InstanceType<typeof SessionAuthzAlsMiddleware>>(SessionAuthzAlsMiddleware);
  });

  it('should call mixin', () => {
    expect(mixin).toHaveBeenCalledTimes(1);
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should set up ALS context with default values', (done) => {
    const req = {
      session: {}
    } as Request;
    const res = {} as Response;
    const next: NextFunction = () => {
      const store = als.getStore();
      expect(store).toEqual({
        user: undefined,
        allowAnonymous: undefined,
        authOptions: sessionAuthzOptions,
        guardResult: undefined,
        logIn: expect.any(Function),
        logOut: expect.any(Function),
        setCookie: expect.any(Function)
      });
      done();
    };

    middleware.use(req, res, next);
  });

  it('should call next function', (done) => {
    const req = {
      session: {}
    } as Request;
    const res = {} as Response;
    const next: NextFunction = jest.fn(() => done());

    middleware.use(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should throw AuthzError when req.session is not defined', (done) => {
    const req = {} as Request;
    const res = {} as Response;
    const next: NextFunction = jest.fn(() => done());

    middleware.use(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.any(AuthzError));
  });

  describe('ALS context methods', () => {
    describe('logIn', () => {
      const res = {} as Response;
      let req: any;
      let user: any;
      let logIn: SessionAlsType<unknown, unknown>['logIn'];

      beforeEach(() => {
        user = { id: 1, username: 'testUser' };
        req = {
          session: {
            regenerate: jest.fn(),
            save: jest.fn()
          }
        };

        middleware.use(req, res, () => {
          const store = als.getStore();
          logIn = store?.logIn!;
        });
      });

      it('should successfully log in a user without keeping session info', async () => {
        req.session.regenerate.mockImplementation((callback: Function) => callback(null));
        req.session.save.mockImplementation((callback: Function) => callback(null));

        await expect(logIn(user)).resolves.toBeUndefined();

        expect(merge).not.toHaveBeenCalled();
        expect(req.session.regenerate).toHaveBeenCalled();
        expect(req.session.save).toHaveBeenCalled();
        expect(req.session[SESSION_PASSPORT_KEY].user).toBe(user);
      });

      it('should successfully log in a user with keeping session info', async () => {
        sessionAuthzOptions.keepSessionInfo = true;
        middleware.use(req, res, () => {
          const store = als.getStore();
          logIn = store?.logIn!;
        });

        const prevSession = { data: 'previous' };
        req.session = { ...req.session, ...prevSession };

        req.session.regenerate.mockImplementation((callback: Function) => callback(null));
        req.session.save.mockImplementation((callback: Function) => callback(null));

        await expect(logIn(user)).resolves.toBeUndefined();

        expect(merge).toHaveBeenCalledTimes(1);
        expect(req.session.regenerate).toHaveBeenCalled();
        expect(req.session.save).toHaveBeenCalled();
        expect(req.session[SESSION_PASSPORT_KEY].user).toBe(user);
        expect(req.session).toMatchObject(prevSession);
      });

      it('should reject when session.regenerate fails', async () => {
        const error = new Error('regenerate error');
        req.session.regenerate.mockImplementation((callback: Function) => callback(error));

        await expect(logIn(user)).rejects.toThrow('regenerate error');

        expect(req.session.regenerate).toHaveBeenCalled();
        expect(req.session.save).not.toHaveBeenCalled();
      });

      it('should reject when session.save fails', async () => {
        req.session.regenerate.mockImplementation((callback: Function) => callback(null));
        const error = new Error('save error');
        req.session.save.mockImplementation((callback: Function) => callback(error));

        await expect(logIn(user)).rejects.toThrow('save error');

        expect(req.session.regenerate).toHaveBeenCalled();
        expect(req.session.save).toHaveBeenCalled();
      });
    });

    describe('logOut', () => {
      const res = {} as Response;
      let req: any;
      let prevSession: Record<string, unknown>;
      let logOut: SessionAlsType<unknown, unknown>['logOut'];

      beforeEach(() => {
        prevSession = { data: 'previous' };
        req = {
          session: {
            [SESSION_PASSPORT_KEY]: {
              user: { id: 1, username: 'testUser' }
            },
            regenerate: jest.fn(),
            save: jest.fn()
          }
        };

        middleware.use(req, res, () => {
          const store = als.getStore();
          logOut = store?.logOut!;
        });
      });

      it('should log out a user successfully without keeping session info', async () => {
        req.session.save.mockImplementation((callback: Function) => callback(null));
        req.session.regenerate.mockImplementation((callback: Function) => callback(null));

        await expect(logOut()).resolves.toBeUndefined();

        expect(req.session.save).toHaveBeenCalled();
        expect(req.session.regenerate).toHaveBeenCalled();
        expect(req.session[SESSION_PASSPORT_KEY].user).toBeUndefined();
      });

      it('should log out a user successfully and keep session info', async () => {
        sessionAuthzOptions.keepSessionInfo = true;
        req.session = { ...req.session, ...prevSession };
        middleware.use(req, res, () => {
          const store = als.getStore();
          logOut = store?.logOut!;
        });

        req.session.save.mockImplementation((callback: Function) => callback(null));
        req.session.regenerate.mockImplementation((callback: Function) => callback(null));

        await expect(logOut()).resolves.toBeUndefined();

        expect(req.session.save).toHaveBeenCalled();
        expect(req.session.regenerate).toHaveBeenCalled();
        expect(req.session).toMatchObject(prevSession);
      });

      it('should handle case when session does not have SESSION_PASSPORT_KEY', async () => {
        delete req.session[SESSION_PASSPORT_KEY];
        req.session.save.mockImplementation((callback: Function) => callback(null));
        req.session.regenerate.mockImplementation((callback: Function) => callback(null));

        await expect(logOut()).resolves.toBeUndefined();

        expect(req.session.save).toHaveBeenCalled();
        expect(req.session.regenerate).toHaveBeenCalled();
        expect(req.session).not.toHaveProperty(SESSION_PASSPORT_KEY);
      });

      it('should reject when session.save fails', async () => {
        const error = new Error('save error');
        req.session.save.mockImplementation((callback: Function) => callback(error));

        await expect(logOut()).rejects.toThrow('save error');

        expect(req.session.save).toHaveBeenCalled();
        expect(req.session.regenerate).not.toHaveBeenCalled();
      });

      it('should reject when session.regenerate fails', async () => {
        req.session.save.mockImplementation((callback: Function) => callback(null));
        const error = new Error('regenerate error');
        req.session.regenerate.mockImplementation((callback: Function) => callback(error));

        await expect(logOut()).rejects.toThrow('regenerate error');

        expect(req.session.save).toHaveBeenCalled();
        expect(req.session.regenerate).toHaveBeenCalled();
      });
    });

    describe('setCookie', () => {
      const res = {} as Response;
      let req: any;

      beforeEach(() => {
        req = {
          session: {
            [SESSION_PASSPORT_KEY]: {
              user: { id: 1, username: 'testUser' }
            },
            regenerate: jest.fn(),
            save: jest.fn()
          }
        };

        middleware.use(req, res, () => {});
      });

      it('should call createSetCookieFn', () => {
        expect(createSetCookieFn).toHaveBeenCalledTimes(1);
      });
    });
  });
});
