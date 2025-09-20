import { AsyncLocalStorage } from 'node:async_hooks';
import { ExecutionContext, mixin } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import { AuthzProviderClass } from '../authz.provider';
import { JwtValidationType, PASSPORT_PROPERTY } from '../constants';
import { AuthzAnonymousError, AuthzError, AuthzVerificationError } from '../errors';
import {
  type AuthzMetaParams,
  decodeMsgpackrString,
  getAllowAnonymous,
  getAlsStore,
  getContextAuthzMetaParamsList,
  getPassportProperty,
  normalizedArray,
  type SetRequired
} from '../utils';
import { createJwtAuthzGuard, createJwtRefreshAuthzGuard } from './jwt-authz.guard';
import type { JwtAuthzOptions } from './jwt-authz.interface';

const user = { id: 1 };
const mockedRequest = { user };

// Mock ExecutionContext helper
function createMockExecutionContext(): ExecutionContext {
  const context = {
    switchToHttp: jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue(mockedRequest)
    }),
    getHandler: jest.fn().mockReturnValue('getHandler'),
    getClass: jest.fn().mockReturnValue('getClass')
  } as unknown as ExecutionContext;
  return context;
}

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

jest.mock('../utils', () => {
  const actual = jest.requireActual('../utils');
  return {
    ...actual,
    getPassportProperty: jest.fn(actual.getPassportProperty),
    getContextAuthzMetaParamsList: jest.fn(actual.getContextAuthzMetaParamsList),
    getAlsStore: jest.fn(actual.getAlsStore),
    getAllowAnonymous: jest.fn(actual.getAllowAnonymous),
    normalizedArray: jest.fn(actual.normalizedArray),
    decodeMsgpackrString: jest.fn(actual.decodeMsgpackrString)
  };
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('Jwt Authz Guard', () => {
  const AUTHZ_PROVIDER = 'AUTHZ_PROVIDER';
  const JWT_AUTHZ_OPTIONS = 'JWT_AUTHZ_OPTIONS';
  const ALS_PROVIDER = 'ALS_PROVIDER';
  const JWT_META_KEY = 'JWT_META_KEY';
  const JWT_REFRESH_META_KEY = 'JWT_REFRESH_META_KEY';

  const testToken = 'test-token';
  const testSecret = 'test-secret';

  let store: Record<string, any>;

  let jwtAuthzGuard: InstanceType<ReturnType<typeof createJwtAuthzGuard>>;
  let reflector: Reflector;
  let mockAuthzProvider: AuthzProviderClass<unknown, unknown>;
  let als: AsyncLocalStorage<any>;
  let jwtAuthzOptions: JwtAuthzOptions;
  let mockJwtExtractor: ReturnType<typeof jest.fn>;

  beforeEach(async () => {
    store = { user, allowAnonymous: undefined, guardResult: undefined };
    jest.mocked(getAlsStore).mockReturnValue(store);

    reflector = new Reflector();
    // @ts-ignore
    mockAuthzProvider = { authorize: jest.fn().mockResolvedValue(true), authenticate: jest.fn() };
    als = new AsyncLocalStorage();
    mockJwtExtractor = jest.fn().mockReturnValue(testToken);
    jwtAuthzOptions = {
      defaultAllowAnonymous: true,
      passportProperty: 'property',
      refresh: {},
      jwt: {
        secretOrPublicKey: testSecret,
        verify: {},
        jwtFromRequest: [mockJwtExtractor]
      }
    } as unknown as JwtAuthzOptions;

    const JwtAuthzGuard = createJwtAuthzGuard([
      AUTHZ_PROVIDER,
      JWT_AUTHZ_OPTIONS,
      ALS_PROVIDER,
      JWT_META_KEY,
      JWT_REFRESH_META_KEY
    ]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthzGuard,
        { provide: Reflector, useValue: reflector },
        { provide: AUTHZ_PROVIDER, useValue: mockAuthzProvider },
        { provide: JWT_AUTHZ_OPTIONS, useValue: jwtAuthzOptions },
        { provide: ALS_PROVIDER, useValue: als }
      ]
    }).compile();

    jwtAuthzGuard = module.get(JwtAuthzGuard);
  });

  it('should call mixin', () => {
    expect(mixin).toHaveBeenCalledTimes(1);
  });

  it('should throw error if AuthzProvider.authenticate is undefined', () => {
    const JwtAuthzGuard = createJwtAuthzGuard([
      AUTHZ_PROVIDER,
      JWT_AUTHZ_OPTIONS,
      ALS_PROVIDER,
      JWT_META_KEY,
      JWT_REFRESH_META_KEY
    ]);

    // @ts-ignore
    mockAuthzProvider.authenticate = undefined;

    expect(() => {
      new JwtAuthzGuard(reflector, mockAuthzProvider, jwtAuthzOptions, als);
    }).toThrow(AuthzError);
  });

  describe('handleRequest', () => {
    it('should return user parameter', async () => {
      const result = jwtAuthzGuard.handleRequest(undefined, user, undefined);

      expect(getAlsStore).toHaveBeenCalledTimes(1);
      expect(getAlsStore).toHaveBeenCalledWith(als);

      expect(result).toEqual(user);
    });
    it('should throw an error if info is defined', async () => {
      expect(() => jwtAuthzGuard.handleRequest(undefined, user, new Error())).toThrow(Error);

      expect(getAlsStore).toHaveBeenCalledTimes(1);
      expect(getAlsStore).toHaveBeenCalledWith(als);

      expect(store.guardResult).toEqual(false);
    });
    it('should return uesr when info is AuthzAnonymousError & allowAnonymous is defined', async () => {
      store.allowAnonymous = true;
      const result = jwtAuthzGuard.handleRequest(undefined, user, new AuthzAnonymousError());

      expect(getAlsStore).toHaveBeenCalledTimes(1);
      expect(getAlsStore).toHaveBeenCalledWith(als);

      expect(result).toEqual(user);
    });
    it('should ignore err parameter', async () => {
      const result = jwtAuthzGuard.handleRequest(new Error(), user, undefined);

      expect(getAlsStore).toHaveBeenCalledTimes(1);
      expect(getAlsStore).toHaveBeenCalledWith(als);

      expect(result).toEqual(user);
    });
  });

  describe('canActivate', () => {
    it('should pass if authorization succeed', async () => {
      jwtAuthzOptions.defaultAllowAnonymous = false;
      jwtAuthzOptions.refresh = undefined;

      const mockUser = { id: 1, name: 'Test User' };
      const mockPayload = { userId: 1 };
      const contextParamsList = [{ metaData: 'META_DATA_1' }, { metaData: 'META_DATA_2' }] as AuthzMetaParams[];

      const mockedGetAll = jest.spyOn(reflector, 'getAll');
      // JWT_REFRESH_META_KEY
      mockedGetAll.mockReturnValueOnce([]);
      // JWT_META_KEY
      mockedGetAll.mockReturnValueOnce(contextParamsList);
      mockAuthzProvider.authorize = jest.fn().mockResolvedValue(true);
      // @ts-ignore
      jest.mocked(jwt.verify).mockReturnValue(mockPayload);
      jest.mocked(mockAuthzProvider.authenticate!).mockResolvedValue(mockUser as never);
      jest.mocked(getAllowAnonymous).mockReturnValue(false);
      jest.mocked(getPassportProperty).mockReturnValue(user);

      const context = createMockExecutionContext();

      const result = await jwtAuthzGuard.canActivate(context);

      expect(getAlsStore).toHaveBeenCalledTimes(3);
      expect(getAlsStore).toHaveBeenCalledWith(als);

      expect(mockedGetAll).toHaveBeenCalledTimes(2);
      expect(mockedGetAll).toHaveBeenNthCalledWith(1, JWT_REFRESH_META_KEY, ['getClass', 'getHandler']);
      expect(mockedGetAll).toHaveBeenNthCalledWith(2, JWT_META_KEY, ['getClass', 'getHandler']);

      expect(normalizedArray).toHaveBeenCalledTimes(2);
      expect(normalizedArray).toHaveBeenNthCalledWith(1, jest.mocked(mockedGetAll).mock.results[0].value);
      expect(normalizedArray).toHaveBeenNthCalledWith(2, jest.mocked(mockedGetAll).mock.results[1].value);

      expect(getContextAuthzMetaParamsList).toHaveBeenCalledTimes(1);
      expect(getContextAuthzMetaParamsList).toHaveBeenCalledWith(contextParamsList, {
        defaultOverride: jwtAuthzOptions.defaultOverride,
        skipFalsyMetadata: jwtAuthzOptions.skipFalsyMetadata
      });

      expect(getAllowAnonymous).toHaveBeenCalledTimes(1);
      expect(getAllowAnonymous).toHaveBeenCalledWith(contextParamsList, {
        defaultAllowAnonymous: jwtAuthzOptions.defaultAllowAnonymous
      });

      expect(store.allowAnonymous).toEqual(jest.mocked(getAllowAnonymous).mock.results[0].value);

      expect(getPassportProperty).toHaveBeenCalledTimes(1);
      expect(getPassportProperty).toHaveBeenCalledWith(mockedRequest);

      expect(mockAuthzProvider.authorize).toHaveBeenCalledTimes(2);
      expect(mockAuthzProvider.authorize).toHaveBeenNthCalledWith(1, user, 'META_DATA_1');
      expect(mockAuthzProvider.authorize).toHaveBeenNthCalledWith(2, user, 'META_DATA_2');

      expect(store.guardResult).toBeUndefined();
      expect(result).toBe(true);
    });

    it('should deny access if authorization fails', async () => {
      jwtAuthzOptions.defaultAllowAnonymous = false;
      jwtAuthzOptions.refresh = undefined;

      const mockUser = { id: 1, name: 'Test User' };
      const mockPayload = { userId: 1 };
      const contextParamsList = [{ metaData: 'META_DATA_1' }, { metaData: 'META_DATA_2' }] as AuthzMetaParams[];

      const mockedGetAll = jest.spyOn(reflector, 'getAll');
      // JWT_REFRESH_META_KEY
      mockedGetAll.mockReturnValueOnce([]);
      // JWT_META_KEY
      mockedGetAll.mockReturnValueOnce(contextParamsList);
      // @ts-ignore
      jest.mocked(jwt.verify).mockReturnValue(mockPayload);
      jest.mocked(mockAuthzProvider.authenticate!).mockResolvedValue(mockUser as never);
      mockAuthzProvider.authorize = jest.fn().mockResolvedValue(false);
      jest.mocked(getAllowAnonymous).mockReturnValue(false);
      jest.mocked(getPassportProperty).mockReturnValue(user);

      const context = createMockExecutionContext();

      const result = await jwtAuthzGuard.canActivate(context);

      expect(mockAuthzProvider.authorize).toHaveBeenCalledTimes(1);
      expect(mockAuthzProvider.authorize).toHaveBeenNthCalledWith(1, user, 'META_DATA_1');

      expect(store.guardResult).toBeUndefined();
      expect(result).toBe(false);
    });

    it('should bypass already store.guardResult is defined', async () => {
      store.guardResult = true;
      const mockedGetAll = jest.spyOn(reflector, 'getAll');

      const context = createMockExecutionContext();

      const result = await jwtAuthzGuard.canActivate(context);

      expect(mockedGetAll).not.toHaveBeenCalled();
      expect(getContextAuthzMetaParamsList).not.toHaveBeenCalled();
      expect(getAllowAnonymous).not.toHaveBeenCalled();
      expect(getPassportProperty).not.toHaveBeenCalled();
      expect(mockAuthzProvider.authorize).not.toHaveBeenCalled();

      expect(result).toBe(store.guardResult);
    });

    it('should bypass if JWT_REFRESH_META_KEY token is found', async () => {
      jwtAuthzOptions.defaultAllowAnonymous = false;

      const mockedGetAll = jest.spyOn(reflector, 'getAll');
      // JWT_REFRESH_META_KEY
      mockedGetAll.mockReturnValueOnce([true]);

      const context = createMockExecutionContext();

      const result = await jwtAuthzGuard.canActivate(context);

      expect(mockedGetAll).toHaveBeenCalledTimes(1);
      expect(mockedGetAll).toHaveBeenNthCalledWith(1, JWT_REFRESH_META_KEY, ['getClass', 'getHandler']);

      expect(getContextAuthzMetaParamsList).not.toHaveBeenCalled();
      expect(getAllowAnonymous).not.toHaveBeenCalled();
      expect(getPassportProperty).not.toHaveBeenCalled();
      expect(mockAuthzProvider.authorize).not.toHaveBeenCalled();

      expect(store.guardResult).toEqual(result);
      expect(result).toBe(true);
    });

    it('should not bypass if JWT_REFRESH_META_KEY token is found but jwtAuthzOptions.refresh is not defined', async () => {
      jwtAuthzOptions.defaultAllowAnonymous = false;
      jwtAuthzOptions.refresh = undefined;

      const mockUser = { id: 1, name: 'Test User' };
      const mockPayload = { userId: 1 };
      const contextParamsList = [{ metaData: 'META_DATA_1' }, { metaData: 'META_DATA_2' }] as AuthzMetaParams[];

      const mockedGetAll = jest.spyOn(reflector, 'getAll');
      // JWT_REFRESH_META_KEY
      mockedGetAll.mockReturnValueOnce([true]);
      // JWT_META_KEY
      mockedGetAll.mockReturnValueOnce(contextParamsList);
      // @ts-ignore
      jest.mocked(jwt.verify).mockReturnValue(mockPayload);
      jest.mocked(mockAuthzProvider.authenticate!).mockResolvedValue(mockUser as never);
      mockAuthzProvider.authorize = jest.fn().mockResolvedValue(true);
      jest.mocked(getAllowAnonymous).mockReturnValue(false);
      jest.mocked(getPassportProperty).mockReturnValue(user);

      const context = createMockExecutionContext();

      const result = await jwtAuthzGuard.canActivate(context);

      expect(mockAuthzProvider.authorize).toHaveBeenCalledTimes(2);
      expect(mockAuthzProvider.authorize).toHaveBeenNthCalledWith(1, user, 'META_DATA_1');
      expect(mockAuthzProvider.authorize).toHaveBeenNthCalledWith(2, user, 'META_DATA_2');

      expect(store.guardResult).toBeUndefined();
      expect(result).toBe(true);
    });

    it('should skip authorize if AuthzMetaParams is empty', async () => {
      const mockUser = { id: 1, name: 'Test User' };
      const mockPayload = { userId: 1 };
      const contextParamsList = [{ metaData: 'META_DATA_1' }, { metaData: 'META_DATA_2' }] as AuthzMetaParams[];

      const mockedGetAll = jest.spyOn(reflector, 'getAll');
      // JWT_REFRESH_META_KEY
      mockedGetAll.mockReturnValueOnce([]);
      // JWT_META_KEY
      mockedGetAll.mockReturnValueOnce([]);
      // @ts-ignore
      jest.mocked(jwt.verify).mockReturnValue(mockPayload);
      jest.mocked(mockAuthzProvider.authenticate!).mockResolvedValue(mockUser as never);
      mockAuthzProvider.authorize = jest.fn().mockResolvedValue(true);
      jest.mocked(getAllowAnonymous).mockReturnValue(false);
      jest.mocked(getPassportProperty).mockReturnValue(user);

      const context = createMockExecutionContext();

      const result = await jwtAuthzGuard.canActivate(context);

      expect(getContextAuthzMetaParamsList).toHaveBeenCalledTimes(1);
      expect(getContextAuthzMetaParamsList).toHaveBeenCalledWith([], {
        defaultOverride: jwtAuthzOptions.defaultOverride,
        skipFalsyMetadata: jwtAuthzOptions.skipFalsyMetadata
      });

      expect(getAllowAnonymous).toHaveBeenCalledTimes(1);
      expect(getAllowAnonymous).toHaveBeenCalledWith([], {
        defaultAllowAnonymous: jwtAuthzOptions.defaultAllowAnonymous
      });

      expect(store.allowAnonymous).toEqual(jest.mocked(getAllowAnonymous).mock.results[0].value);

      expect(getPassportProperty).toHaveBeenCalledTimes(1);
      expect(getPassportProperty).toHaveBeenCalledWith(mockedRequest);

      expect(mockAuthzProvider.authorize).not.toHaveBeenCalled();

      expect(store.guardResult).toBeUndefined();
      expect(result).toBe(true);
    });

    it('should bypass if public is true in the last AuthzMetaParams', async () => {
      jwtAuthzOptions.defaultAllowAnonymous = false;
      jwtAuthzOptions.refresh = undefined;

      const contextParamsList = [
        { metaData: 'META_DATA_1' },
        { metaData: 'META_DATA_2', options: { public: true } }
      ] as AuthzMetaParams[];

      const mockedGetAll = jest.spyOn(reflector, 'getAll');
      // JWT_REFRESH_META_KEY
      mockedGetAll.mockReturnValueOnce([]);
      // JWT_META_KEY
      mockedGetAll.mockReturnValueOnce(contextParamsList);

      mockAuthzProvider.authorize = jest.fn().mockResolvedValue(true);

      const context = createMockExecutionContext();

      const result = await jwtAuthzGuard.canActivate(context);

      expect(getAlsStore).toHaveBeenCalled();
      expect(mockedGetAll).toHaveBeenCalled();
      expect(normalizedArray).toHaveBeenCalled();

      expect(getContextAuthzMetaParamsList).not.toHaveBeenCalled();
      expect(getAllowAnonymous).not.toHaveBeenCalled();
      expect(getPassportProperty).not.toHaveBeenCalled();
      expect(mockAuthzProvider.authorize).not.toHaveBeenCalled();

      expect(store.guardResult).toBe(true);
      expect(result).toBe(true);
    });

    it('should skip authorize method if user is not defined & allowAnonymous is true', async () => {
      jwtAuthzOptions.defaultAllowAnonymous = false;
      jwtAuthzOptions.refresh = undefined;

      const contextParamsList = [
        { metaData: 'META_DATA_1' },
        { metaData: 'META_DATA_2', allowAnonymous: true }
      ] as AuthzMetaParams[];

      const mockedGetAll = jest.spyOn(reflector, 'getAll');
      // JWT_REFRESH_META_KEY
      mockedGetAll.mockReturnValueOnce([]);
      // JWT_META_KEY
      mockedGetAll.mockReturnValueOnce(contextParamsList);

      mockAuthzProvider.authorize = jest.fn().mockResolvedValue(true);

      jest.mocked(getAllowAnonymous).mockReturnValue(true);

      jest.mocked(getPassportProperty).mockReturnValue(undefined);

      const context = createMockExecutionContext();

      const result = await jwtAuthzGuard.canActivate(context);

      expect(getPassportProperty).toHaveBeenCalledTimes(1);
      expect(getPassportProperty).toHaveBeenCalledWith(mockedRequest);

      expect(mockAuthzProvider.authorize).not.toHaveBeenCalled();

      expect(store.guardResult).toBeUndefined();
      expect(result).toBe(true);
    });

    it('should skip authorize method if user is not defined & defaultAllowAnonymous is true', async () => {
      jwtAuthzOptions.defaultAllowAnonymous = true;
      jwtAuthzOptions.refresh = undefined;

      const contextParamsList = [{ metaData: 'META_DATA_1' }, { metaData: 'META_DATA_2' }] as AuthzMetaParams[];

      const mockedGetAll = jest.spyOn(reflector, 'getAll');
      // JWT_REFRESH_META_KEY
      mockedGetAll.mockReturnValueOnce([]);
      // JWT_META_KEY
      mockedGetAll.mockReturnValueOnce(contextParamsList);

      mockAuthzProvider.authorize = jest.fn().mockResolvedValue(true);

      jest.mocked(getAllowAnonymous).mockReturnValue(true);

      jest.mocked(getPassportProperty).mockReturnValue(undefined);

      const context = createMockExecutionContext();

      const result = await jwtAuthzGuard.canActivate(context);

      expect(getPassportProperty).toHaveBeenCalledTimes(1);
      expect(getPassportProperty).toHaveBeenCalledWith(mockedRequest);

      expect(mockAuthzProvider.authorize).not.toHaveBeenCalled();

      expect(store.guardResult).toBeUndefined();
      expect(result).toBe(true);
    });

    it('should not skip authorize method if user is defined & allowAnonymous is true', async () => {
      jwtAuthzOptions.defaultAllowAnonymous = true;
      jwtAuthzOptions.refresh = undefined;

      const contextParamsList = [
        { metaData: 'META_DATA_1' },
        { metaData: 'META_DATA_2', allowAnonymous: true }
      ] as AuthzMetaParams[];

      const mockedGetAll = jest.spyOn(reflector, 'getAll');
      // JWT_REFRESH_META_KEY
      mockedGetAll.mockReturnValueOnce([]);
      // JWT_META_KEY
      mockedGetAll.mockReturnValueOnce(contextParamsList);

      mockAuthzProvider.authorize = jest.fn().mockResolvedValue(true);

      jest.mocked(getAllowAnonymous).mockReturnValue(true);

      jest.mocked(getPassportProperty).mockReturnValue(user);

      const context = createMockExecutionContext();

      const result = await jwtAuthzGuard.canActivate(context);

      expect(mockAuthzProvider.authorize).toHaveBeenCalledTimes(2);
      expect(mockAuthzProvider.authorize).toHaveBeenNthCalledWith(1, user, 'META_DATA_1');
      expect(mockAuthzProvider.authorize).toHaveBeenNthCalledWith(2, user, 'META_DATA_2');

      expect(store.guardResult).toBeUndefined();
      expect(result).toBe(true);
    });
  });

  describe('validate', () => {
    it('should return user on successful validation', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined };
      const mockPayload = { userId: 1 };
      const mockUser = { id: 1, name: 'Test User' };

      // @ts-ignore
      jest.mocked(jwt.verify).mockReturnValue(mockPayload);
      jest.mocked(mockAuthzProvider.authenticate).mockResolvedValue(mockUser as never);

      const user = await jwtAuthzGuard.validate(req);

      expect(getAlsStore).toHaveBeenCalledTimes(1);
      expect(getAlsStore).toHaveBeenCalledWith(als);

      expect(mockJwtExtractor).toHaveBeenCalledTimes(1);
      expect(mockJwtExtractor).toHaveBeenCalledWith(req);

      expect(jwt.verify).toHaveBeenCalledTimes(1);
      expect(jwt.verify).toHaveBeenCalledWith('test-token', 'test-secret', jwtAuthzOptions.jwt.verify);

      expect(mockAuthzProvider.authenticate).toHaveBeenCalledTimes(1);
      expect(mockAuthzProvider.authenticate).toHaveBeenCalledWith(jest.mocked(jwt.verify).mock.results[0].value, req);

      expect(req[PASSPORT_PROPERTY]).toEqual(jwtAuthzOptions.passportProperty);
      expect(store.user).toEqual(mockUser);
      expect(store.jwtVerifiedBy).toEqual(JwtValidationType.JWT);
      expect(user).toEqual([mockUser]);
    });

    it('should throw an AuthzError if jwtAuthzOptions.jwt.verify is not defined', async () => {
      // @ts-ignore
      jwtAuthzOptions.jwt.verify = undefined;

      const req = { [PASSPORT_PROPERTY]: undefined };

      const [user, error] = await jwtAuthzGuard.validate(req);

      expect(jwt.verify).not.toHaveBeenCalled();
      expect(decodeMsgpackrString).not.toHaveBeenCalled();
      expect(mockAuthzProvider.authenticate).not.toHaveBeenCalled();

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzError);
    });

    it('should return AuthzAnonymousError if no token is provided', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined };

      mockJwtExtractor.mockReturnValue(null);

      const [user, error] = await jwtAuthzGuard.validate(req);

      expect(jwt.verify).not.toHaveBeenCalled();
      expect(decodeMsgpackrString).not.toHaveBeenCalled();
      expect(mockAuthzProvider.authenticate).not.toHaveBeenCalled();

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzAnonymousError);
    });

    it('should return AuthzAnonymousError if user is null', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined };
      const mockPayload = { userId: 1 };
      const mockUser = null;

      // @ts-ignore
      jest.mocked(jwt.verify).mockReturnValue(mockPayload);
      jest.mocked(mockAuthzProvider.authenticate).mockResolvedValue(mockUser as never);

      const [user, error] = await jwtAuthzGuard.validate(req);

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzAnonymousError);
    });

    it('should return AuthzVerificationError if jwt.verify throws Error', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined };
      jwt.verify = jest.fn(() => {
        throw new Error('Verification failed');
      });

      const [user, error] = await jwtAuthzGuard.validate(req);

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzVerificationError);
      expect(error.message).toBe(`Error: Verification failed`);
    });

    it('should return AuthzVerificationError if jwt.verify throws customr object', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined };
      jwt.verify = jest.fn(() => {
        throw 'Error';
      });

      const [user, error] = await jwtAuthzGuard.validate(req);

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzVerificationError);
      expect(error.message).toBe(`Error`);
    });

    it('should return AuthzVerificationError if jwt.verify throws Error', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined };
      jwt.verify = jest.fn(() => {
        throw new Error('Verification failed');
      });

      const [user, error] = await jwtAuthzGuard.validate(req);

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzVerificationError);
      expect(error.message).toBe(`Error: Verification failed`);
    });

    it('should return AuthzVerificationError if AuthzProvider.authenticate throws Error', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined };
      const mockPayload = { userId: 1 };

      // @ts-ignore
      jest.mocked(jwt.verify).mockReturnValue(mockPayload);
      jest.mocked(mockAuthzProvider.authenticate).mockImplementation(
        jest.fn(() => {
          throw new Error('Verification failed');
        })
      );

      const [user, error] = await jwtAuthzGuard.validate(req);

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzVerificationError);
      expect(error.message).toBe(`Error: Verification failed`);
    });
  });
});

describe('JwtRefreshAuthzGuard', () => {
  const JWT_AUTHZ_OPTIONS = 'JWT_AUTHZ_OPTIONS';
  const AUTHZ_PROVIDER = 'AUTHZ_PROVIDER';
  const ALS_PROVIDER = 'ALS_PROVIDER';
  const testToken = 'test-token';
  const testSecret = 'test-secret';

  let jwtRefreshAuthzGuard: InstanceType<ReturnType<typeof createJwtRefreshAuthzGuard>>;
  let jwtAuthzOptions: JwtAuthzOptions;
  let als: AsyncLocalStorage<any>;
  let mockAuthzProvider: AuthzProviderClass<unknown, unknown>;
  let mockJwtExtractor: ReturnType<typeof jest.fn>;
  let store: Record<string, any>;

  beforeEach(async () => {
    // @ts-ignore
    mockAuthzProvider = { authorize: jest.fn().mockResolvedValue(true), authenticate: jest.fn() };
    mockJwtExtractor = jest.fn().mockReturnValue(testToken);
    als = new AsyncLocalStorage();

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
      jwtVerifiedBy: undefined
    };
    jest.mocked(getAlsStore).mockReturnValue(store);

    const JwtRefreshAuthzGuard = createJwtRefreshAuthzGuard([JWT_AUTHZ_OPTIONS, AUTHZ_PROVIDER, ALS_PROVIDER]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtRefreshAuthzGuard,
        { provide: JWT_AUTHZ_OPTIONS, useValue: jwtAuthzOptions },
        { provide: ALS_PROVIDER, useValue: als },
        { provide: AUTHZ_PROVIDER, useValue: mockAuthzProvider }
      ]
    }).compile();

    jwtRefreshAuthzGuard = module.get(JwtRefreshAuthzGuard);
  });

  it('should throw error if AuthzProvider.authenticate is undefined', () => {
    const JwtRefreshAuthzGuard = createJwtRefreshAuthzGuard([JWT_AUTHZ_OPTIONS, AUTHZ_PROVIDER, ALS_PROVIDER]);

    // @ts-ignore
    mockAuthzProvider.authenticate = undefined;

    expect(() => {
      new JwtRefreshAuthzGuard(jwtAuthzOptions, mockAuthzProvider, als);
    }).toThrow(AuthzError);
  });

  describe('handleRequest', () => {
    it('should return user parameter', async () => {
      const result = jwtRefreshAuthzGuard.handleRequest(undefined, user, undefined);
      expect(result).toEqual(user);
    });
    it('should throw an error if info is defined', async () => {
      expect(() => jwtRefreshAuthzGuard.handleRequest(undefined, user, new Error())).toThrow(Error);
    });
    it('should ignore err parameter', async () => {
      const result = jwtRefreshAuthzGuard.handleRequest(new Error(), user, undefined);
      expect(result).toEqual(user);
    });
  });

  describe('canActivate', () => {
    it('should return true if validated', async () => {
      const mockEncodedPayload = {
        data: 'encoded string'
      };
      const mockPayload = { userId: 1 };
      const mockUser = { id: 1, name: 'Test User' };

      // @ts-ignore
      jest.mocked(jwt.verify).mockReturnValue(mockEncodedPayload);
      jest.mocked(decodeMsgpackrString).mockReturnValue(mockPayload);
      jest.mocked(mockAuthzProvider.authenticate!).mockResolvedValue(mockUser as never);

      const context = createMockExecutionContext();

      const result = await jwtRefreshAuthzGuard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('validate', () => {
    it('should return user on successful validation', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined };
      const mockEncodedPayload = {
        data: 'encoded string'
      };
      const mockPayload = { userId: 1 };
      const mockUser = { id: 1, name: 'Test User' };

      // @ts-ignore
      jest.mocked(jwt.verify).mockReturnValue(mockEncodedPayload);
      jest.mocked(decodeMsgpackrString).mockReturnValue(mockPayload);
      jest.mocked(mockAuthzProvider.authenticate).mockResolvedValue(mockUser as never);

      const user = await jwtRefreshAuthzGuard.validate(req);

      expect(getAlsStore).toHaveBeenCalledTimes(1);
      expect(getAlsStore).toHaveBeenCalledWith(als);

      expect(mockJwtExtractor).toHaveBeenCalledTimes(1);
      expect(mockJwtExtractor).toHaveBeenCalledWith(req);

      expect(jwt.verify).toHaveBeenCalledTimes(1);
      expect(jwt.verify).toHaveBeenCalledWith('test-token', 'test-secret', jwtAuthzOptions.refresh!.verify);

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
      expect(user).toEqual([mockUser]);
    });

    it('should throw an AuthzError if jwtAuthzOptions.refresh.verify is not defined', async () => {
      // @ts-ignore
      jwtAuthzOptions.refresh.verify = undefined;

      const req = { [PASSPORT_PROPERTY]: undefined };

      const [user, error] = await jwtRefreshAuthzGuard.validate(req);

      expect(jwt.verify).not.toHaveBeenCalled();
      expect(decodeMsgpackrString).not.toHaveBeenCalled();
      expect(mockAuthzProvider.authenticate).not.toHaveBeenCalled();

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzError);
    });

    it('should return AuthzAnonymousError if no token is provided', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined };

      mockJwtExtractor.mockReturnValue(null);

      const [user, error] = await jwtRefreshAuthzGuard.validate(req);

      expect(jwt.verify).not.toHaveBeenCalled();
      expect(decodeMsgpackrString).not.toHaveBeenCalled();
      expect(mockAuthzProvider.authenticate).not.toHaveBeenCalled();

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzAnonymousError);
    });

    it('should return AuthzAnonymousError if user is null', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined };
      const mockPayload = { userId: 1 };
      const mockUser = null;

      // @ts-ignore
      jest.mocked(jwt.verify).mockReturnValue(mockPayload);
      jest.mocked(mockAuthzProvider.authenticate).mockResolvedValue(mockUser as never);

      const [user, error] = await jwtRefreshAuthzGuard.validate(req);

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzAnonymousError);
    });

    it('should return AuthzVerificationError if jwt.verify throws Error', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined };
      jwt.verify = jest.fn(() => {
        throw new Error('Verification failed');
      });

      const [user, error] = await jwtRefreshAuthzGuard.validate(req);

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzVerificationError);
      expect(error.message).toBe(`Error: Verification failed`);
    });

    it('should return AuthzVerificationError if jwt.verify throws customr object', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined };
      jwt.verify = jest.fn(() => {
        throw 'Error';
      });

      const [user, error] = await jwtRefreshAuthzGuard.validate(req);

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzVerificationError);
      expect(error.message).toBe(`Error`);
    });

    it('should return AuthzVerificationError if AuthzProvider.authenticate throws Error', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined };
      const mockPayload = { userId: 1 };

      // @ts-ignore
      jest.mocked(jwt.verify).mockReturnValue(mockPayload);
      jest.mocked(mockAuthzProvider.authenticate).mockImplementation(
        jest.fn(() => {
          throw new Error('Verification failed');
        })
      );

      const [user, error] = await jwtRefreshAuthzGuard.validate(req);

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzVerificationError);
      expect(error.message).toBe(`Error: Verification failed`);
    });
  });
});
