import { AsyncLocalStorage } from 'node:async_hooks';
import { mixin } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { Strategy } from 'passport-custom';
import { AuthzProviderClass } from '../authz.provider';
import { JwtValidationType, PASSPORT_PROPERTY } from '../constants';
import { AuthzAnonymousError, AuthzError, AuthzVerificationError } from '../errors';
import { decodeMsgpackrString, getAlsStore, type SetRequired } from '../utils';
import type { JwtAuthzOptions } from './jwt-authz.interface';
import { createJwtStrategy, createRefreshStrategy } from './jwt-authz.strategy';
import type { JwtAlsType } from './jwt-authz-als.middleware';

jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');

  return {
    ...actual,
    mixin: jest.fn(actual.mixin)
  };
});

jest.mock('jsonwebtoken', () => {
  const actual = jest.requireActual('jsonwebtoken');
  return {
    ...actual,
    verify: jest.fn()
  };
});

jest.mock('@nestjs/passport', () => {
  const actual = jest.requireActual('@nestjs/passport');
  return {
    ...actual,
    PassportStrategy: jest.fn(actual.PassportStrategy)
  };
});

jest.mock('./extract-jwt', () => {
  const actual = jest.requireActual('./extract-jwt');
  return {
    ...actual,
    ExtractJwt: {
      ...actual.ExtractJwt,
      fromExtractors: jest.fn(actual.ExtractJwt.fromExtractors)
    }
  };
});

jest.mock('../utils', () => {
  const actual = jest.requireActual('../utils');
  return {
    ...actual,
    getAlsStore: jest.fn(actual.getAlsStore),
    decodeMsgpackrString: jest.fn(actual.decodeMsgpackrString)
  };
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('Jwt Authz Strategy', () => {
  const JWT_STRATEGY = 'JWT_STRATEGY';
  const AUTHZ_PROVIDER = 'AUTHZ_PROVIDER';
  const ALS_PROVIDER = 'ALS_PROVIDER';

  let jwtStrategy: InstanceType<ReturnType<typeof createJwtStrategy>>;
  let store: Record<string, any>;

  const mockAls = new AsyncLocalStorage() as AsyncLocalStorage<JwtAlsType<unknown>>;
  const testToken = 'test-token';
  const testSecret = 'test-secret';

  let mockAuthzProvider: AuthzProviderClass<unknown, unknown>;
  let jwtAuthzOptions: JwtAuthzOptions;
  let mockJwtExtractor: ReturnType<typeof jest.fn>;

  beforeEach(async () => {
    mockAuthzProvider = { authenticate: jest.fn() } as unknown as AuthzProviderClass<unknown, unknown>;
    mockJwtExtractor = jest.fn().mockReturnValue(testToken);
    jwtAuthzOptions = {
      jwt: {
        secretOrPublicKey: testSecret,
        verify: {},
        jwtFromRequest: [mockJwtExtractor]
      },
      passportProperty: 'uesr'
    } as unknown as JwtAuthzOptions;

    store = {
      user: undefined,
      jwtVerifiedBy: undefined,
      authOptions: jwtAuthzOptions
    };

    jest.mocked(getAlsStore).mockReturnValue(store);

    const JwtStrategy = createJwtStrategy([JWT_STRATEGY, AUTHZ_PROVIDER, ALS_PROVIDER]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: AUTHZ_PROVIDER, useValue: mockAuthzProvider },
        { provide: ALS_PROVIDER, useValue: mockAls },
        JwtStrategy
      ]
    }).compile();

    jwtStrategy = module.get(JwtStrategy);
  });

  it('should call mixin', () => {
    expect(mixin).toHaveBeenCalledTimes(1);
  });

  describe('constructor', () => {
    it('should return an instance', () => {
      expect(PassportStrategy).toHaveBeenCalledTimes(1);
      expect(PassportStrategy).toHaveBeenCalledWith(Strategy, JWT_STRATEGY);

      expect(jwtStrategy).toBeInstanceOf(jest.mocked(PassportStrategy).mock.results[0].value);
    });

    it('should throw an AuthzError if AuthzProvider.authenticate is not a function', () => {
      // @ts-ignore
      mockAuthzProvider.authenticate = undefined;
      expect(
        () => new (createJwtStrategy([JWT_STRATEGY, AUTHZ_PROVIDER, ALS_PROVIDER]))(mockAuthzProvider, mockAls)
      ).toThrow(
        new AuthzError(`InternalError: Method 'authenticate' from abstract class 'AuthzProvider' must be implemented.`)
      );
    });
  });

  describe('validate', () => {
    it('should return user on successful validation', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined } as unknown as Request;
      const mockPayload = { userId: 1 };
      const mockUser = { id: 1, name: 'Test User' };

      // @ts-ignore
      jest.mocked(jwt.verify).mockReturnValue(mockPayload);
      jest.mocked(mockAuthzProvider.authenticate).mockResolvedValue(mockUser as never);

      const user = await jwtStrategy.validate(req);

      expect(getAlsStore).toHaveBeenCalledTimes(1);
      expect(getAlsStore).toHaveBeenCalledWith(mockAls);

      expect(mockJwtExtractor).toHaveBeenCalledTimes(1);
      expect(mockJwtExtractor).toHaveBeenCalledWith(req);

      expect(jwt.verify).toHaveBeenCalledTimes(1);
      expect(jwt.verify).toHaveBeenCalledWith('test-token', 'test-secret', jwtAuthzOptions.jwt.verify);

      expect(mockAuthzProvider.authenticate).toHaveBeenCalledTimes(1);
      expect(mockAuthzProvider.authenticate).toHaveBeenCalledWith(jest.mocked(jwt.verify).mock.results[0].value, req);

      expect(req[PASSPORT_PROPERTY]).toEqual(jwtAuthzOptions.passportProperty);
      expect(store.user).toEqual(mockUser);
      expect(store.jwtVerifiedBy).toEqual(JwtValidationType.JWT);
      expect(user).toEqual(mockUser);
    });

    it('should throw an AuthzError if jwtAuthzOptions.jwt.verify is not defined', async () => {
      // @ts-ignore
      jwtAuthzOptions.jwt.verify = undefined;

      const req = { [PASSPORT_PROPERTY]: undefined } as unknown as Request;

      // @ts-ignore
      const [user, error] = await jwtStrategy.validate(req);

      expect(jwt.verify).not.toHaveBeenCalled();
      expect(decodeMsgpackrString).not.toHaveBeenCalled();
      expect(mockAuthzProvider.authenticate).not.toHaveBeenCalled();

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzError);
    });

    it('should return AuthzAnonymousError if no token is provided', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined } as unknown as Request;

      mockJwtExtractor.mockReturnValue(null);

      // @ts-ignore
      const [user, error] = await jwtStrategy.validate(req);

      expect(jwt.verify).not.toHaveBeenCalled();
      expect(decodeMsgpackrString).not.toHaveBeenCalled();
      expect(mockAuthzProvider.authenticate).not.toHaveBeenCalled();

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzAnonymousError);
    });

    it('should return AuthzAnonymousError if user is null', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined } as unknown as Request;
      const mockPayload = { userId: 1 };
      const mockUser = null;

      // @ts-ignore
      jest.mocked(jwt.verify).mockReturnValue(mockPayload);
      jest.mocked(mockAuthzProvider.authenticate).mockResolvedValue(mockUser as never);

      // @ts-ignore
      const [user, error] = await jwtStrategy.validate(req);

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzAnonymousError);
    });

    it('should return AuthzVerificationError if jwt.verify throws Error', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined } as unknown as Request;
      jwt.verify = jest.fn(() => {
        throw new Error('Verification failed');
      });

      // @ts-ignore
      const [user, error] = await jwtStrategy.validate(req);

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzVerificationError);
      expect(error.message).toBe(`Error: Verification failed`);
    });

    it('should return AuthzVerificationError if jwt.verify throws customr object', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined } as unknown as Request;
      jwt.verify = jest.fn(() => {
        throw 'Error';
      });

      // @ts-ignore
      const [user, error] = await jwtStrategy.validate(req);

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzVerificationError);
      expect(error.message).toBe(`Error`);
    });

    it('should return AuthzVerificationError if jwt.verify throws Error', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined } as unknown as Request;
      jwt.verify = jest.fn(() => {
        throw new Error('Verification failed');
      });

      // @ts-ignore
      const [user, error] = await jwtStrategy.validate(req);

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzVerificationError);
      expect(error.message).toBe(`Error: Verification failed`);
    });

    it('should return AuthzVerificationError if AuthzProvider.authenticate throws Error', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined } as unknown as Request;
      const mockPayload = { userId: 1 };

      // @ts-ignore
      jest.mocked(jwt.verify).mockReturnValue(mockPayload);
      jest.mocked(mockAuthzProvider.authenticate).mockImplementation(
        jest.fn(() => {
          throw new Error('Verification failed');
        })
      );

      // @ts-ignore
      const [user, error] = await jwtStrategy.validate(req);

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzVerificationError);
      expect(error.message).toBe(`Error: Verification failed`);
    });
  });
});

describe('RefreshStrategy', () => {
  const JWT_REFRESH_STRATEGY = 'JWT_REFRESH_STRATEGY';
  const AUTHZ_PROVIDER = 'AUTHZ_PROVIDER';
  const ALS_PROVIDER = 'ALS_PROVIDER';

  let refreshStrategy: InstanceType<ReturnType<typeof createRefreshStrategy>>;
  let store: Record<string, any>;

  const mockAls = new AsyncLocalStorage() as AsyncLocalStorage<JwtAlsType<unknown>>;
  const testToken = 'test-token';
  const testSecret = 'test-secret';

  let mockAuthzProvider: AuthzProviderClass<unknown, unknown>;
  let jwtAuthzOptions: SetRequired<JwtAuthzOptions, 'refresh'>;
  let mockJwtExtractor: ReturnType<typeof jest.fn>;

  beforeEach(async () => {
    mockAuthzProvider = { authenticate: jest.fn() } as unknown as AuthzProviderClass<unknown, unknown>;
    mockJwtExtractor = jest.fn().mockReturnValue(testToken);
    jwtAuthzOptions = {
      refresh: {
        secretOrPublicKey: testSecret,
        verify: {},
        jwtFromRequest: [mockJwtExtractor]
      },
      passportProperty: 'uesr'
    } as unknown as SetRequired<JwtAuthzOptions, 'refresh'>;

    store = {
      user: undefined,
      jwtVerifiedBy: undefined,
      authOptions: jwtAuthzOptions
    };
    jest.mocked(getAlsStore).mockReturnValue(store);

    const RefreshStrategy = createRefreshStrategy([JWT_REFRESH_STRATEGY, AUTHZ_PROVIDER, ALS_PROVIDER]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: AUTHZ_PROVIDER, useValue: mockAuthzProvider },
        { provide: ALS_PROVIDER, useValue: mockAls },
        RefreshStrategy
      ]
    }).compile();

    refreshStrategy = module.get(RefreshStrategy);
  });

  describe('constructor', () => {
    it('should return an instance', () => {
      expect(PassportStrategy).toHaveBeenCalledTimes(1);
      expect(PassportStrategy).toHaveBeenCalledWith(Strategy, JWT_REFRESH_STRATEGY);

      expect(refreshStrategy).toBeInstanceOf(jest.mocked(PassportStrategy).mock.results[0].value);
    });

    it('should throw an AuthzError if AuthzProvider.authenticate is not a function', () => {
      // @ts-ignore
      mockAuthzProvider.authenticate = undefined;
      expect(
        () => new (createRefreshStrategy([JWT_REFRESH_STRATEGY, AUTHZ_PROVIDER, ALS_PROVIDER]))(mockAuthzProvider)
      ).toThrow(
        new AuthzError(`InternalError: Method 'authenticate' from abstract class 'AuthzProvider' must be implemented.`)
      );
    });
  });

  describe('validate', () => {
    it('should return user on successful validation', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined } as unknown as Request;
      const mockEncodedPayload = {
        data: 'encoded string'
      };
      const mockPayload = { userId: 1 };
      const mockUser = { id: 1, name: 'Test User' };

      // @ts-ignore
      jest.mocked(jwt.verify).mockReturnValue(mockEncodedPayload);
      jest.mocked(decodeMsgpackrString).mockReturnValue(mockPayload);
      jest.mocked(mockAuthzProvider.authenticate).mockResolvedValue(mockUser as never);

      const user = await refreshStrategy.validate(req);

      expect(getAlsStore).toHaveBeenCalledTimes(1);
      expect(getAlsStore).toHaveBeenCalledWith(mockAls);

      expect(mockJwtExtractor).toHaveBeenCalledTimes(1);
      expect(mockJwtExtractor).toHaveBeenCalledWith(req);

      expect(jwt.verify).toHaveBeenCalledTimes(1);
      expect(jwt.verify).toHaveBeenCalledWith('test-token', 'test-secret', jwtAuthzOptions.refresh.verify);

      expect(decodeMsgpackrString).toHaveBeenCalledTimes(1);
      expect(decodeMsgpackrString).toHaveBeenCalledWith(mockEncodedPayload.data);

      expect(mockAuthzProvider.authenticate).toHaveBeenCalledTimes(1);
      expect(mockAuthzProvider.authenticate).toHaveBeenCalledWith(
        jest.mocked(decodeMsgpackrString).mock.results[0].value,
        req
      );

      expect(req[PASSPORT_PROPERTY]).toEqual(jwtAuthzOptions.passportProperty);
      expect(store.user).toEqual(mockUser);
      expect(store.jwtVerifiedBy).toEqual(JwtValidationType.REFRESH);
      expect(user).toEqual(mockUser);
    });

    it('should throw an AuthzError if jwtAuthzOptions.refresh.verify is not defined', async () => {
      // @ts-ignore
      jwtAuthzOptions.refresh.verify = undefined;

      const req = { [PASSPORT_PROPERTY]: undefined } as unknown as Request;

      // @ts-ignore
      const [user, error] = await refreshStrategy.validate(req);

      expect(jwt.verify).not.toHaveBeenCalled();
      expect(decodeMsgpackrString).not.toHaveBeenCalled();
      expect(mockAuthzProvider.authenticate).not.toHaveBeenCalled();

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzError);
    });

    it('should return AuthzAnonymousError if no token is provided', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined } as unknown as Request;

      mockJwtExtractor.mockReturnValue(null);

      // @ts-ignore
      const [user, error] = await refreshStrategy.validate(req);

      expect(jwt.verify).not.toHaveBeenCalled();
      expect(decodeMsgpackrString).not.toHaveBeenCalled();
      expect(mockAuthzProvider.authenticate).not.toHaveBeenCalled();

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzAnonymousError);
    });

    it('should return AuthzAnonymousError if user is null', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined } as unknown as Request;
      const mockPayload = { userId: 1 };
      const mockUser = null;

      // @ts-ignore
      jest.mocked(jwt.verify).mockReturnValue(mockPayload);
      jest.mocked(mockAuthzProvider.authenticate).mockResolvedValue(mockUser as never);

      // @ts-ignore
      const [user, error] = await refreshStrategy.validate(req);

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzAnonymousError);
    });

    it('should return AuthzVerificationError if jwt.verify throws Error', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined } as unknown as Request;
      jwt.verify = jest.fn(() => {
        throw new Error('Verification failed');
      });

      // @ts-ignore
      const [user, error] = await refreshStrategy.validate(req);

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzVerificationError);
      expect(error.message).toBe(`Error: Verification failed`);
    });

    it('should return AuthzVerificationError if jwt.verify throws customr object', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined } as unknown as Request;
      jwt.verify = jest.fn(() => {
        throw 'Error';
      });

      // @ts-ignore
      const [user, error] = await refreshStrategy.validate(req);

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzVerificationError);
      expect(error.message).toBe(`Error`);
    });

    it('should return AuthzVerificationError if AuthzProvider.authenticate throws Error', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined } as unknown as Request;
      const mockPayload = { userId: 1 };

      // @ts-ignore
      jest.mocked(jwt.verify).mockReturnValue(mockPayload);
      jest.mocked(mockAuthzProvider.authenticate).mockImplementation(
        jest.fn(() => {
          throw new Error('Verification failed');
        })
      );

      // @ts-ignore
      const [user, error] = await refreshStrategy.validate(req);

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzVerificationError);
      expect(error.message).toBe(`Error: Verification failed`);
    });
  });
});
