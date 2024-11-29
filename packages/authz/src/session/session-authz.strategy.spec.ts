import { AsyncLocalStorage } from 'node:async_hooks';
import { mixin } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import type { Request } from 'express';
import { Strategy } from 'passport-custom';
import { AuthzProviderClass } from '../authz.provider';
import { PASSPORT_PROPERTY, SESSION_PASSPORT_KEY } from '../constants';
import { AuthzAnonymousError, AuthzError, AuthzVerificationError } from '../errors';
import { getAlsStore } from '../utils';
import type { SessionAlsType } from './session-authz-als.middleware';
import type { SessionAuthzOptions } from './session-authz.interface';
import { createSessionAuthzStrategy } from './session-authz.strategy';

jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');

  return {
    ...actual,
    mixin: jest.fn(actual.mixin)
  };
});

jest.mock('@nestjs/passport', () => {
  const actual = jest.requireActual('@nestjs/passport');
  return {
    ...actual,
    PassportStrategy: jest.fn(actual.PassportStrategy)
  };
});

jest.mock('../utils', () => {
  const actual = jest.requireActual('../utils');
  return {
    ...actual,
    getAlsStore: jest.fn(actual.getAlsStore)
  };
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('Session Authz Strategy', () => {
  const SESSION_STRATEGY = 'SESSION_STRATEGY';
  const AUTHZ_PROVIDER = 'AUTHZ_PROVIDER';
  const SESSION_AUTHZ_OPTIONS = 'SESSION_AUTHZ_OPTIONS';
  const ALS_PROVIDER = 'ALS_PROVIDER';

  let sessionStrategy: InstanceType<ReturnType<typeof createSessionAuthzStrategy>>;
  let store: Record<string, any>;

  const mockAls = new AsyncLocalStorage() as AsyncLocalStorage<SessionAlsType<unknown, unknown>>;

  let mockAuthzProvider: AuthzProviderClass<unknown, unknown>;
  let sessionAuthzOptions: SessionAuthzOptions;

  beforeEach(async () => {
    mockAuthzProvider = { authenticate: jest.fn() } as unknown as AuthzProviderClass<unknown, unknown>;
    sessionAuthzOptions = {
      passportProperty: 'uesr'
    } as unknown as SessionAuthzOptions;

    store = {
      authOptions: sessionAuthzOptions
    };

    jest.mocked(getAlsStore).mockReturnValue(store);

    const SessionStrategy = createSessionAuthzStrategy([SESSION_STRATEGY, AUTHZ_PROVIDER, ALS_PROVIDER]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: AUTHZ_PROVIDER, useValue: mockAuthzProvider },
        { provide: SESSION_AUTHZ_OPTIONS, useValue: sessionAuthzOptions },
        { provide: ALS_PROVIDER, useValue: mockAls },
        SessionStrategy
      ]
    }).compile();

    sessionStrategy = module.get(SessionStrategy);
  });

  it('should call mixin', () => {
    expect(mixin).toHaveBeenCalledTimes(1);
  });

  describe('constructor', () => {
    it('should return an instance', () => {
      expect(PassportStrategy).toHaveBeenCalledTimes(1);
      expect(PassportStrategy).toHaveBeenCalledWith(Strategy, SESSION_STRATEGY);

      expect(sessionStrategy).toBeInstanceOf(jest.mocked(PassportStrategy).mock.results[0].value);
    });

    it('should throw an AuthzError if AuthzProvider.authenticate is not a function', () => {
      // @ts-ignore
      mockAuthzProvider.authenticate = undefined;
      expect(
        () =>
          new (createSessionAuthzStrategy([SESSION_STRATEGY, AUTHZ_PROVIDER, ALS_PROVIDER]))(
            mockAuthzProvider,
            sessionAuthzOptions,
            mockAls
          )
      ).toThrow(
        new AuthzError(`InternalError: Method 'authenticate' from abstract class 'AuthzProvider' must be implemented.`)
      );
    });
  });

  describe('validate', () => {
    it('should return user on successful validation', async () => {
      const mockPayload = { userId: 1 };
      const mockUser = { id: 1, name: 'Test User' };
      const req = {
        [PASSPORT_PROPERTY]: undefined,
        session: {
          [SESSION_PASSPORT_KEY]: {
            user: mockPayload
          }
        }
      } as unknown as Request;

      jest.mocked(mockAuthzProvider.authenticate).mockResolvedValue(mockUser as never);

      const user = await sessionStrategy.validate(req);

      expect(mockAuthzProvider.authenticate).toHaveBeenCalledTimes(1);
      expect(mockAuthzProvider.authenticate).toHaveBeenCalledWith(mockPayload);

      expect(getAlsStore).toHaveBeenCalledTimes(1);
      expect(getAlsStore).toHaveBeenCalledWith(mockAls);

      expect(req[PASSPORT_PROPERTY]).toEqual(sessionAuthzOptions.passportProperty);
      expect(store.user).toEqual(mockUser);
      expect(user).toEqual(mockUser);
    });

    it('should return AuthzAnonymousError if session user is not found', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined } as unknown as Request;

      // @ts-ignore
      const [user, error] = await sessionStrategy.validate(req);

      expect(mockAuthzProvider.authenticate).not.toHaveBeenCalled();

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzAnonymousError);
    });

    it('should return AuthzAnonymousError if AuthzProvider.authenticate return null', async () => {
      const mockPayload = { userId: 1 };
      const mockUser = null;
      const req = {
        [PASSPORT_PROPERTY]: undefined,
        session: {
          [SESSION_PASSPORT_KEY]: {
            user: mockPayload
          }
        }
      } as unknown as Request;

      jest.mocked(mockAuthzProvider.authenticate).mockResolvedValue(mockUser as never);

      // @ts-ignore
      const [user, error] = await sessionStrategy.validate(req);

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzAnonymousError);

      expect(store.user).toEqual(mockUser);
    });

    it('should return AuthzVerificationError if AuthzProvider.authenticate throws Error', async () => {
      const mockPayload = { userId: 1 };
      const req = {
        [PASSPORT_PROPERTY]: undefined,
        session: {
          [SESSION_PASSPORT_KEY]: {
            user: mockPayload
          }
        }
      } as unknown as Request;

      jest.mocked(mockAuthzProvider.authenticate).mockImplementation(
        jest.fn(() => {
          throw new Error('Verification failed');
        })
      );

      // @ts-ignore
      const [user, error] = await sessionStrategy.validate(req);

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzVerificationError);
      expect(error.message).toBe(`Error: Verification failed`);
    });

    it('should return AuthzVerificationError if AuthzProvider.authenticate throws customr object', async () => {
      const mockPayload = { userId: 1 };
      const req = {
        [PASSPORT_PROPERTY]: undefined,
        session: {
          [SESSION_PASSPORT_KEY]: {
            user: mockPayload
          }
        }
      } as unknown as Request;

      jest.mocked(mockAuthzProvider.authenticate).mockImplementation(
        jest.fn(() => {
          throw `Error`;
        })
      );

      // @ts-ignore
      const [user, error] = await sessionStrategy.validate(req);

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzVerificationError);
      expect(error.message).toBe(`Error`);
    });
  });
});
