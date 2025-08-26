import { AsyncLocalStorage } from 'node:async_hooks';
import { mixin } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SESSION_PASSPORT_KEY } from '../constants';
import { AuthzError } from '../errors';
import { createSetCookieFn, type RawRequestWithShims, type RawResponseWithShims } from '../utils';
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
  let defaultReq: RawRequestWithShims;
  let defaultRes: RawResponseWithShims;

  beforeEach(async () => {
    als = new AsyncLocalStorage();
    sessionAuthzOptions = {
      keepSessionInfo: false
    } as SessionAuthzOptions;

    defaultReq = {
      shims: {
        getSession: jest.fn(),
        getAllSession: jest.fn(),
        setSession: jest.fn(),
        deleteSession: jest.fn(),
        sessionContains: jest.fn(),
        regenerateSession: jest.fn(),
        saveSession: jest.fn()
      }
    };

    defaultRes = {
      shims: {
        setCookie: jest.fn()
      }
    };

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
    const req: RawRequestWithShims = {
      ...defaultReq,
      session: {}
    };
    const res: RawResponseWithShims = {
      ...defaultRes
    };
    const next = () => {
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
    const req: RawRequestWithShims = {
      ...defaultReq,
      session: {}
    };
    const res: RawResponseWithShims = {
      ...defaultRes
    };
    const next = jest.fn(() => done());

    middleware.use(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  describe('ALS context methods', () => {
    describe('logIn', () => {
      const res: RawResponseWithShims = {
        ...defaultRes
      };
      let req: RawRequestWithShims;
      let user: any;
      let logIn: SessionAlsType<unknown, unknown>['logIn'];

      beforeEach(() => {
        user = { id: 1, username: 'testUser' };
        req = {
          ...defaultReq,
          session: {}
        };

        middleware.use(req, res, () => {
          const store = als.getStore();
          logIn = store?.logIn!;
        });
      });

      it('should successfully log in a user without keeping session info', async () => {
        jest.mocked(req.shims.regenerateSession).mockResolvedValue();
        jest.mocked(req.shims.saveSession).mockResolvedValue();

        await expect(logIn(user)).resolves.toBeUndefined();

        expect(req.shims.getAllSession).toHaveBeenCalled();
        expect(req.shims.regenerateSession).toHaveBeenCalled();
        expect(req.shims.getSession).toHaveBeenCalledWith(SESSION_PASSPORT_KEY);
        expect(req.shims.setSession).toHaveBeenCalledWith(SESSION_PASSPORT_KEY, { user: user });
        expect(req.shims.saveSession).toHaveBeenCalled();
      });

      it('should successfully log in a user with keeping session info', async () => {
        sessionAuthzOptions.keepSessionInfo = true;
        middleware.use(req, res, () => {
          const store = als.getStore();
          logIn = store?.logIn!;
        });

        const prevSession = { data: 'previous' };
        jest.mocked(req.shims.getAllSession).mockReturnValue(prevSession);
        jest.mocked(req.shims.regenerateSession).mockResolvedValue();
        jest.mocked(req.shims.sessionContains).mockReturnValue(true);
        jest.mocked(req.shims.saveSession).mockResolvedValue();

        req.session = { ...req.session, ...prevSession };

        await expect(logIn(user)).resolves.toBeUndefined();

        expect(req.shims.getAllSession).toHaveBeenCalled();
        expect(req.shims.regenerateSession).toHaveBeenCalled();
        expect(req.shims.sessionContains).toHaveBeenCalled();
        for (const key in prevSession) {
          expect(req.shims.setSession).toHaveBeenCalledWith(key, prevSession[key]);
        }
        expect(req.shims.getSession).toHaveBeenCalledWith(SESSION_PASSPORT_KEY);
        expect(req.shims.setSession).toHaveBeenCalledWith(SESSION_PASSPORT_KEY, { user: user });
        expect(req.shims.saveSession).toHaveBeenCalled();
      });

      it('should reject when session.regenerate fails', async () => {
        const error = new Error('regenerate error');
        jest.mocked(req.shims.regenerateSession).mockRejectedValue(error);

        await expect(logIn(user)).rejects.toThrow('regenerate error');

        expect(req.shims.regenerateSession).toHaveBeenCalled();
        expect(req.shims.saveSession).not.toHaveBeenCalled();
      });

      it('should reject when session.save fails', async () => {
        const error = new Error('save error');
        jest.mocked(req.shims.saveSession).mockRejectedValue(error);

        await expect(logIn(user)).rejects.toThrow('save error');

        expect(req.shims.regenerateSession).toHaveBeenCalled();
        expect(req.shims.saveSession).toHaveBeenCalled();
      });
    });

    describe('logOut', () => {
      const res: RawResponseWithShims = {
        ...defaultRes
      };
      let req: RawRequestWithShims;
      let prevSession: Record<string, unknown>;
      let logOut: SessionAlsType<unknown, unknown>['logOut'];

      beforeEach(() => {
        prevSession = { other: 'other' };
        req = {
          ...defaultReq,
          session: {
            [SESSION_PASSPORT_KEY]: {
              user: { id: 1, username: 'testUser' },
              other: 'other'
            }
          }
        };

        middleware.use(req, res, () => {
          const store = als.getStore();
          logOut = store?.logOut!;
        });
      });

      it('should log out a user successfully without keeping session info', async () => {
        jest.mocked(req.shims.sessionContains).mockReturnValueOnce(true);
        jest.mocked(req.shims.getSession).mockReturnValueOnce(req.session[SESSION_PASSPORT_KEY]);
        jest.mocked(req.shims.getAllSession).mockReturnValue(prevSession);
        jest.mocked(req.shims.saveSession).mockResolvedValue();
        jest.mocked(req.shims.regenerateSession).mockResolvedValue();
        jest.mocked(req.shims.sessionContains).mockReturnValue(true);

        await expect(logOut()).resolves.toBeUndefined();

        expect(req.shims.setSession).toHaveBeenCalledWith(SESSION_PASSPORT_KEY, prevSession);
        expect(req.shims.getAllSession).toHaveBeenCalled();
        expect(req.shims.saveSession).toHaveBeenCalled();
        expect(req.shims.regenerateSession).toHaveBeenCalled();
      });

      it('should log out a user successfully and keep session info', async () => {
        sessionAuthzOptions.keepSessionInfo = true;
        req.session = { ...req.session, ...prevSession };
        middleware.use(req, res, () => {
          const store = als.getStore();
          logOut = store?.logOut!;
        });

        jest.mocked(req.shims.sessionContains).mockReturnValueOnce(true);
        jest.mocked(req.shims.getSession).mockReturnValueOnce(req.session[SESSION_PASSPORT_KEY]);
        jest.mocked(req.shims.getAllSession).mockReturnValue(prevSession);
        jest.mocked(req.shims.saveSession).mockResolvedValue();
        jest.mocked(req.shims.regenerateSession).mockResolvedValue();
        jest.mocked(req.shims.sessionContains).mockReturnValue(true);

        await expect(logOut()).resolves.toBeUndefined();

        expect(req.shims.setSession).toHaveBeenCalledWith(SESSION_PASSPORT_KEY, prevSession);
        expect(req.shims.getAllSession).toHaveBeenCalled();
        expect(req.shims.saveSession).toHaveBeenCalled();
        expect(req.shims.regenerateSession).toHaveBeenCalled();
        for (const key in prevSession) {
          expect(req.shims.setSession).toHaveBeenCalledWith(key, prevSession[key]);
        }
      });

      it('should handle case when session does not have SESSION_PASSPORT_KEY', async () => {
        delete req.session[SESSION_PASSPORT_KEY];
        jest.mocked(req.shims.sessionContains).mockReturnValueOnce(false);
        jest.mocked(req.shims.getSession).mockReturnValueOnce(req.session[SESSION_PASSPORT_KEY]);

        await expect(logOut()).resolves.toBeUndefined();

        expect(req.shims.setSession).not.toHaveBeenCalledWith(SESSION_PASSPORT_KEY, prevSession);
        expect(req.shims.saveSession).toHaveBeenCalled();
        expect(req.shims.regenerateSession).toHaveBeenCalled();
      });

      it('should reject when session.save fails', async () => {
        const error = new Error('save error');
        jest.mocked(req.shims.saveSession).mockRejectedValue(error);

        await expect(logOut()).rejects.toThrow('save error');

        expect(req.shims.saveSession).toHaveBeenCalled();
        expect(req.shims.regenerateSession).not.toHaveBeenCalled();
      });

      it('should reject when session.regenerate fails', async () => {
        const error = new Error('regenerate error');
        jest.mocked(req.shims.regenerateSession).mockRejectedValue(error);

        await expect(logOut()).rejects.toThrow('regenerate error');

        expect(req.shims.saveSession).toHaveBeenCalled();
        expect(req.shims.regenerateSession).toHaveBeenCalled();
      });
    });

    describe('setCookie', () => {
      const res: RawResponseWithShims = {
        ...defaultRes
      };
      let req: RawRequestWithShims;

      beforeEach(() => {
        req = {
          ...defaultReq,
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
