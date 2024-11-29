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
  getPassportProperty
} from '../utils';
import { createSessionAuthzGuard } from './session-authz.guard';
import type { SessionAuthzOptions } from './session-authz.interface';

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
    getAllowAnonymous: jest.fn(actual.getAllowAnonymous)
  };
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('Session Authz Guard', () => {
  const SESSION_STRATEGY = 'SESSION_STRATEGY';
  const AUTHZ_PROVIDER = 'AUTHZ_PROVIDER';
  const SESSION_AUTHZ_OPTIONS = 'SESSION_AUTHZ_OPTIONS';
  const ALS_PROVIDER = 'ALS_PROVIDER';
  const SESSION_META_KEY = 'SESSION_META_KEY';

  let mockSuperCanActivate: jest.SpyInstance;
  let store: Record<string, any>;

  let sessionAuthzGuard: InstanceType<ReturnType<typeof createSessionAuthzGuard>>;
  let reflector: Reflector;
  let mockAuthzProvider: Partial<AuthzProviderClass<unknown, unknown>>;
  let als: AsyncLocalStorage<any>;
  let sessionAuthzOptions: SessionAuthzOptions;

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
    sessionAuthzOptions = {
      session: {
        secret: '123456'
      },
      defaultAllowAnonymous: true,
      passportProperty: 'property'
    } as unknown as SessionAuthzOptions;

    const SessionAuthzGuard = createSessionAuthzGuard([
      SESSION_STRATEGY,
      AUTHZ_PROVIDER,
      SESSION_AUTHZ_OPTIONS,
      ALS_PROVIDER,
      SESSION_META_KEY
    ]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionAuthzGuard,
        { provide: Reflector, useValue: reflector },
        { provide: AUTHZ_PROVIDER, useValue: mockAuthzProvider },
        { provide: SESSION_AUTHZ_OPTIONS, useValue: sessionAuthzOptions },
        { provide: ALS_PROVIDER, useValue: als }
      ]
    }).compile();

    sessionAuthzGuard = module.get(SessionAuthzGuard);
  });

  it('should call mixin', () => {
    expect(mixin).toHaveBeenCalledTimes(1);
  });

  describe('constructor', () => {
    it('should return an instance', () => {
      expect(AuthGuard).toHaveBeenCalledTimes(1);
      expect(AuthGuard).toHaveBeenCalledWith(SESSION_STRATEGY);

      expect(sessionAuthzGuard).toBeInstanceOf(jest.mocked(AuthGuard).mock.results[0].value);
    });
  });

  describe('handleRequest', () => {
    it('should return passport options', async () => {
      expect(sessionAuthzGuard.getAuthenticateOptions()).toEqual({
        property: sessionAuthzOptions.passportProperty,
        session: false
      });
    });
  });

  describe('getAuthenticateOptions', () => {
    it('should return property & sessionsession', async () => {
      const result = sessionAuthzGuard.getAuthenticateOptions();
      expect(result).toEqual({
        property: sessionAuthzOptions.passportProperty,
        session: false
      });
    });
  });

  describe('handleRequest', () => {
    it('should return user parameter', async () => {
      const result = sessionAuthzGuard.handleRequest(undefined, user, undefined);

      expect(getAlsStore).toHaveBeenCalledTimes(1);
      expect(getAlsStore).toHaveBeenCalledWith(als);

      expect(result).toEqual(user);
    });
    it('should throw an error if info is defined', async () => {
      expect(() => sessionAuthzGuard.handleRequest(undefined, user, new Error())).toThrow(Error);

      expect(getAlsStore).toHaveBeenCalledTimes(1);
      expect(getAlsStore).toHaveBeenCalledWith(als);

      expect(store.guardResult).toEqual(false);
    });
    it('should return uesr when info is AuthzAnonymousError & allowAnonymous is defined', async () => {
      store.allowAnonymous = true;
      const result = sessionAuthzGuard.handleRequest(undefined, user, new AuthzAnonymousError());

      expect(getAlsStore).toHaveBeenCalledTimes(1);
      expect(getAlsStore).toHaveBeenCalledWith(als);

      expect(result).toEqual(user);
    });
    it('should ignore err parameter', async () => {
      const result = sessionAuthzGuard.handleRequest(new Error(), user, undefined);

      expect(getAlsStore).toHaveBeenCalledTimes(1);
      expect(getAlsStore).toHaveBeenCalledWith(als);

      expect(result).toEqual(user);
    });
  });

  describe('canActivate', () => {
    it('should pass if authorization succeed', async () => {
      sessionAuthzOptions.defaultAllowAnonymous = false;

      const contextParamsList = [{ metaData: 'META_DATA_1' }, { metaData: 'META_DATA_2' }] as AuthzMetaParams[];

      const mockedGetAll = jest.spyOn(reflector, 'getAll');
      mockedGetAll.mockReturnValueOnce(contextParamsList);

      mockAuthzProvider.authorize = jest.fn().mockResolvedValue(true);

      jest.mocked(getAllowAnonymous).mockReturnValue(false);

      jest.mocked(getPassportProperty).mockReturnValue(user);

      const context = createMockExecutionContext();

      const result = await sessionAuthzGuard.canActivate(context);

      expect(getAlsStore).toHaveBeenCalledTimes(1);
      expect(getAlsStore).toHaveBeenCalledWith(als);

      expect(mockedGetAll).toHaveBeenCalledTimes(1);
      expect(mockedGetAll).toHaveBeenCalledWith(SESSION_META_KEY, ['getClass', 'getHandler']);

      expect(getContextAuthzMetaParamsList).toHaveBeenCalledTimes(1);
      expect(getContextAuthzMetaParamsList).toHaveBeenCalledWith(contextParamsList, {
        defaultOverride: sessionAuthzOptions.defaultOverride,
        skipFalsyMetadata: sessionAuthzOptions.skipFalsyMetadata
      });

      expect(getAllowAnonymous).toHaveBeenCalledTimes(1);
      expect(getAllowAnonymous).toHaveBeenCalledWith(contextParamsList, {
        defaultAllowAnonymous: sessionAuthzOptions.defaultAllowAnonymous
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
      sessionAuthzOptions.defaultAllowAnonymous = false;

      const contextParamsList = [{ metaData: 'META_DATA_1' }, { metaData: 'META_DATA_2' }] as AuthzMetaParams[];

      const mockedGetAll = jest.spyOn(reflector, 'getAll');
      mockedGetAll.mockReturnValueOnce(contextParamsList);

      mockAuthzProvider.authorize = jest.fn().mockResolvedValue(false);

      jest.mocked(getAllowAnonymous).mockReturnValue(false);

      jest.mocked(getPassportProperty).mockReturnValue(user);

      const context = createMockExecutionContext();

      const result = await sessionAuthzGuard.canActivate(context);

      expect(mockAuthzProvider.authorize).toHaveBeenCalledTimes(1);
      expect(mockAuthzProvider.authorize).toHaveBeenNthCalledWith(1, user, 'META_DATA_1');

      expect(store.guardResult).toBeUndefined();
      expect(result).toBe(false);
    });

    it('should bypass already store.guardResult is defined', async () => {
      store.guardResult = true;
      const mockedGetAll = jest.spyOn(reflector, 'getAll');

      const context = createMockExecutionContext();

      const result = await sessionAuthzGuard.canActivate(context);

      expect(mockedGetAll).not.toHaveBeenCalled();
      expect(getContextAuthzMetaParamsList).not.toHaveBeenCalled();
      expect(getAllowAnonymous).not.toHaveBeenCalled();
      expect(mockSuperCanActivate).not.toHaveBeenCalled();
      expect(getPassportProperty).not.toHaveBeenCalled();
      expect(mockAuthzProvider.authorize).not.toHaveBeenCalled();

      expect(result).toBe(store.guardResult);
    });

    it('should bypass if AuthzMetaParams is empry', async () => {
      sessionAuthzOptions.defaultAllowAnonymous = false;

      const mockedGetAll = jest.spyOn(reflector, 'getAll');
      mockedGetAll.mockReturnValueOnce([]);

      mockAuthzProvider.authorize = jest.fn().mockResolvedValue(true);

      jest.mocked(getAllowAnonymous).mockReturnValue(false);

      jest.mocked(getPassportProperty).mockReturnValue(user);

      const context = createMockExecutionContext();

      const result = await sessionAuthzGuard.canActivate(context);

      expect(getContextAuthzMetaParamsList).toHaveBeenCalledTimes(1);
      expect(getContextAuthzMetaParamsList).toHaveBeenCalledWith([], {
        defaultOverride: sessionAuthzOptions.defaultOverride,
        skipFalsyMetadata: sessionAuthzOptions.skipFalsyMetadata
      });

      expect(getAllowAnonymous).not.toHaveBeenCalled();
      expect(mockSuperCanActivate).not.toHaveBeenCalled();
      expect(getPassportProperty).not.toHaveBeenCalled();
      expect(mockAuthzProvider.authorize).not.toHaveBeenCalled();

      expect(store.guardResult).toBeUndefined();
      expect(result).toBe(true);
    });

    it('should bypass if AuthzProvider.authorize is not implemented', async () => {
      sessionAuthzOptions.defaultAllowAnonymous = false;
      mockAuthzProvider.authorize = undefined;

      const contextParamsList = [{ metaData: 'META_DATA_1' }, { metaData: 'META_DATA_2' }] as AuthzMetaParams[];

      const mockedGetAll = jest.spyOn(reflector, 'getAll');
      mockedGetAll.mockReturnValueOnce(contextParamsList);

      jest.mocked(getAllowAnonymous).mockReturnValue(false);

      jest.mocked(getPassportProperty).mockReturnValue(user);

      const context = createMockExecutionContext();

      const result = await sessionAuthzGuard.canActivate(context);

      expect(mockSuperCanActivate).toHaveBeenCalledTimes(1);
      expect(mockSuperCanActivate).toHaveBeenCalledWith(context);

      expect(getPassportProperty).not.toHaveBeenCalled();

      expect(store.guardResult).toEqual(result);
      expect(result).toBe(true);
    });

    it('should bypass if user is not defined & allowAnonymous is configured', async () => {
      sessionAuthzOptions.defaultAllowAnonymous = true;

      const contextParamsList = [
        { metaData: 'META_DATA_1' },
        { metaData: 'META_DATA_2', allowAnonymous: true }
      ] as AuthzMetaParams[];

      const mockedGetAll = jest.spyOn(reflector, 'getAll');
      mockedGetAll.mockReturnValueOnce(contextParamsList);

      mockAuthzProvider.authorize = jest.fn().mockResolvedValue(true);

      jest.mocked(getAllowAnonymous).mockReturnValue(true);

      jest.mocked(getPassportProperty).mockReturnValue(undefined);

      const context = createMockExecutionContext();

      const result = await sessionAuthzGuard.canActivate(context);

      expect(getPassportProperty).toHaveBeenCalledTimes(1);
      expect(getPassportProperty).toHaveBeenCalledWith(mockedRequest);

      expect(mockAuthzProvider.authorize).not.toHaveBeenCalled();

      expect(store.guardResult).toBeUndefined();
      expect(result).toBe(true);
    });

    it('should not bypass if user is defined & allowAnonymous is configured', async () => {
      sessionAuthzOptions.defaultAllowAnonymous = true;

      const contextParamsList = [
        { metaData: 'META_DATA_1' },
        { metaData: 'META_DATA_2', allowAnonymous: true }
      ] as AuthzMetaParams[];

      const mockedGetAll = jest.spyOn(reflector, 'getAll');
      mockedGetAll.mockReturnValueOnce(contextParamsList);

      mockAuthzProvider.authorize = jest.fn().mockResolvedValue(true);

      jest.mocked(getAllowAnonymous).mockReturnValue(true);

      jest.mocked(getPassportProperty).mockReturnValue(user);

      const context = createMockExecutionContext();

      const result = await sessionAuthzGuard.canActivate(context);

      expect(mockAuthzProvider.authorize).toHaveBeenCalledTimes(2);
      expect(mockAuthzProvider.authorize).toHaveBeenNthCalledWith(1, user, 'META_DATA_1');
      expect(mockAuthzProvider.authorize).toHaveBeenNthCalledWith(2, user, 'META_DATA_2');

      expect(store.guardResult).toBeUndefined();
      expect(result).toBe(true);
    });
  });
});
