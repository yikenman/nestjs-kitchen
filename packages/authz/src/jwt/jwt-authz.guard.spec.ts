import { AsyncLocalStorage } from 'node:async_hooks';
import { ExecutionContext, mixin } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthzProviderClass } from '../authz.provider';
import { AuthzAnonymousError } from '../errors';
import {
  type AuthzMetaParams,
  getAllowAnonymous,
  getAlsStore,
  getContextAuthzMetaParamsList,
  getPassportProperty,
  normalizedArray
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

jest.mock('@nestjs/passport', () => {
  const actual = jest.requireActual('@nestjs/passport');
  return {
    ...actual,
    AuthGuard: jest.fn(actual.AuthGuard)
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
    normalizedArray: jest.fn(actual.normalizedArray)
  };
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('Jwt Authz Guard', () => {
  const JWT_STRATEGY = 'JWT_STRATEGY';
  const AUTHZ_PROVIDER = 'AUTHZ_PROVIDER';
  const JWT_AUTHZ_OPTIONS = 'JWT_AUTHZ_OPTIONS';
  const ALS_PROVIDER = 'ALS_PROVIDER';
  const JWT_META_KEY = 'JWT_META_KEY';
  const JWT_REFRESH_META_KEY = 'JWT_REFRESH_META_KEY';

  let mockSuperCanActivate: jest.SpyInstance;
  let store: Record<string, any>;

  let jwtAuthzGuard: InstanceType<ReturnType<typeof createJwtAuthzGuard>>;
  let reflector: Reflector;
  let mockAuthzProvider: Partial<AuthzProviderClass<unknown, unknown>>;
  let als: AsyncLocalStorage<any>;
  let jwtAuthzOptions: JwtAuthzOptions;

  beforeEach(async () => {
    jest.mocked(AuthGuard).mockImplementation((...rest: any[]) => {
      const baseCls = jest.requireActual('@nestjs/passport').AuthGuard(...rest);
      mockSuperCanActivate = jest.spyOn(baseCls.prototype, 'canActivate').mockResolvedValue(true);
      return baseCls;
    });

    store = { user, allowAnonymous: undefined, guardResult: undefined };
    jest.mocked(getAlsStore).mockReturnValue(store);

    reflector = new Reflector();
    mockAuthzProvider = { authorize: jest.fn().mockResolvedValue(true) };
    als = new AsyncLocalStorage();
    jwtAuthzOptions = {
      defaultAllowAnonymous: true,
      passportProperty: 'property',
      refresh: {}
    } as unknown as JwtAuthzOptions;

    const JwtAuthzGuard = createJwtAuthzGuard([
      JWT_STRATEGY,
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

  describe('constructor', () => {
    it('should return an instance', () => {
      expect(AuthGuard).toHaveBeenCalledTimes(1);
      expect(AuthGuard).toHaveBeenCalledWith(JWT_STRATEGY);

      expect(jwtAuthzGuard).toBeInstanceOf(jest.mocked(AuthGuard).mock.results[0].value);
    });
  });

  describe('getAuthenticateOptions', () => {
    it('should return property & sessionsession', async () => {
      const result = jwtAuthzGuard.getAuthenticateOptions();
      expect(result).toEqual({
        property: jwtAuthzOptions.passportProperty,
        session: false
      });
    });
  });

  describe('handleRequest', () => {
    it('should return passport options', async () => {
      expect(jwtAuthzGuard.getAuthenticateOptions()).toEqual({
        property: jwtAuthzOptions.passportProperty,
        session: false
      });
    });
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

      const contextParamsList = [{ metaData: 'META_DATA_1' }, { metaData: 'META_DATA_2' }] as AuthzMetaParams[];

      const mockedGetAll = jest.spyOn(reflector, 'getAll');
      // JWT_REFRESH_META_KEY
      mockedGetAll.mockReturnValueOnce([]);
      // JWT_META_KEY
      mockedGetAll.mockReturnValueOnce(contextParamsList);

      mockAuthzProvider.authorize = jest.fn().mockResolvedValue(true);

      jest.mocked(getAllowAnonymous).mockReturnValue(false);

      jest.mocked(getPassportProperty).mockReturnValue(user);

      const context = createMockExecutionContext();

      const result = await jwtAuthzGuard.canActivate(context);

      expect(getAlsStore).toHaveBeenCalledTimes(1);
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

      expect(mockSuperCanActivate).toHaveBeenCalledTimes(1);
      expect(mockSuperCanActivate).toHaveBeenCalledWith(context);

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

      const contextParamsList = [{ metaData: 'META_DATA_1' }, { metaData: 'META_DATA_2' }] as AuthzMetaParams[];

      const mockedGetAll = jest.spyOn(reflector, 'getAll');
      // JWT_REFRESH_META_KEY
      mockedGetAll.mockReturnValueOnce([]);
      // JWT_META_KEY
      mockedGetAll.mockReturnValueOnce(contextParamsList);

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
      expect(mockSuperCanActivate).not.toHaveBeenCalled();
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
      expect(mockSuperCanActivate).not.toHaveBeenCalled();
      expect(getPassportProperty).not.toHaveBeenCalled();
      expect(mockAuthzProvider.authorize).not.toHaveBeenCalled();

      expect(store.guardResult).toEqual(result);
      expect(result).toBe(true);
    });

    it('should not bypass if JWT_REFRESH_META_KEY token is found but jwtAuthzOptions.refresh is not defined', async () => {
      jwtAuthzOptions.defaultAllowAnonymous = false;
      jwtAuthzOptions.refresh = undefined;

      const contextParamsList = [{ metaData: 'META_DATA_1' }, { metaData: 'META_DATA_2' }] as AuthzMetaParams[];

      const mockedGetAll = jest.spyOn(reflector, 'getAll');
      // JWT_REFRESH_META_KEY
      mockedGetAll.mockReturnValueOnce([true]);
      // JWT_META_KEY
      mockedGetAll.mockReturnValueOnce(contextParamsList);

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

    it('should bypass if AuthzMetaParams is empry', async () => {
      jwtAuthzOptions.defaultAllowAnonymous = false;
      jwtAuthzOptions.refresh = undefined;

      const mockedGetAll = jest.spyOn(reflector, 'getAll');
      // JWT_REFRESH_META_KEY
      mockedGetAll.mockReturnValueOnce([]);
      // JWT_META_KEY
      mockedGetAll.mockReturnValueOnce([]);

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

      expect(getAllowAnonymous).not.toHaveBeenCalled();
      expect(mockSuperCanActivate).not.toHaveBeenCalled();
      expect(getPassportProperty).not.toHaveBeenCalled();
      expect(mockAuthzProvider.authorize).not.toHaveBeenCalled();

      expect(store.guardResult).toBeUndefined();
      expect(result).toBe(true);
    });

    it('should bypass if AuthzProvider.authorize is not implemented', async () => {
      jwtAuthzOptions.defaultAllowAnonymous = false;
      jwtAuthzOptions.refresh = undefined;
      mockAuthzProvider.authorize = undefined;

      const contextParamsList = [{ metaData: 'META_DATA_1' }, { metaData: 'META_DATA_2' }] as AuthzMetaParams[];

      const mockedGetAll = jest.spyOn(reflector, 'getAll');
      // JWT_REFRESH_META_KEY
      mockedGetAll.mockReturnValueOnce([]);
      // JWT_META_KEY
      mockedGetAll.mockReturnValueOnce(contextParamsList);

      jest.mocked(getAllowAnonymous).mockReturnValue(false);

      jest.mocked(getPassportProperty).mockReturnValue(user);

      const context = createMockExecutionContext();

      const result = await jwtAuthzGuard.canActivate(context);

      expect(mockSuperCanActivate).toHaveBeenCalledTimes(1);
      expect(mockSuperCanActivate).toHaveBeenCalledWith(context);

      expect(getPassportProperty).not.toHaveBeenCalled();

      expect(store.guardResult).toEqual(result);
      expect(result).toBe(true);
    });

    it('should bypass if user is not defined & allowAnonymous is configured', async () => {
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

      jest.mocked(getPassportProperty).mockReturnValue(undefined);

      const context = createMockExecutionContext();

      const result = await jwtAuthzGuard.canActivate(context);

      expect(getPassportProperty).toHaveBeenCalledTimes(1);
      expect(getPassportProperty).toHaveBeenCalledWith(mockedRequest);

      expect(mockAuthzProvider.authorize).not.toHaveBeenCalled();

      expect(store.guardResult).toBeUndefined();
      expect(result).toBe(true);
    });

    it('should not bypass if user is defined & allowAnonymous is configured', async () => {
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
});

describe('JwtRefreshAuthzGuard', () => {
  const JWT_REFRESH_STRATEGY = 'JWT_REFRESH_STRATEGY';
  const JWT_AUTHZ_OPTIONS = 'JWT_AUTHZ_OPTIONS';

  let mockSuperCanActivate: jest.SpyInstance;
  let jwtRefreshAuthzGuard: InstanceType<ReturnType<typeof createJwtRefreshAuthzGuard>>;
  let jwtAuthzOptions: JwtAuthzOptions;

  beforeEach(async () => {
    jest.mocked(AuthGuard).mockImplementation((...rest: any[]) => {
      const baseCls = jest.requireActual('@nestjs/passport').AuthGuard(...rest);
      mockSuperCanActivate = jest.spyOn(baseCls.prototype, 'canActivate').mockResolvedValue(true);
      return baseCls;
    });

    jwtAuthzOptions = {
      defaultAllowAnonymous: true,
      property: 'property',
      refresh: {}
    } as unknown as JwtAuthzOptions;

    const JwtRefreshAuthzGuard = createJwtRefreshAuthzGuard([JWT_REFRESH_STRATEGY, JWT_AUTHZ_OPTIONS]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtRefreshAuthzGuard, { provide: JWT_AUTHZ_OPTIONS, useValue: jwtAuthzOptions }]
    }).compile();

    jwtRefreshAuthzGuard = module.get(JwtRefreshAuthzGuard);
  });

  describe('constructor', () => {
    it('should return an instance', () => {
      expect(AuthGuard).toHaveBeenCalledTimes(1);
      expect(AuthGuard).toHaveBeenCalledWith(JWT_REFRESH_STRATEGY);

      expect(jwtRefreshAuthzGuard).toBeInstanceOf(jest.mocked(AuthGuard).mock.results[0].value);
    });
  });

  describe('handleRequest', () => {
    it('should return passport options', async () => {
      expect(jwtRefreshAuthzGuard.getAuthenticateOptions()).toEqual({
        property: jwtAuthzOptions.passportProperty,
        session: false
      });
    });
  });

  describe('getAuthenticateOptions', () => {
    it('should return property & sessionsession', async () => {
      const result = jwtRefreshAuthzGuard.getAuthenticateOptions();
      expect(result).toEqual({
        property: jwtAuthzOptions.passportProperty,
        session: false
      });
    });
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
});
