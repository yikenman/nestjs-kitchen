import { AsyncLocalStorage } from 'node:async_hooks';
import { ExecutionContext, mixin } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthzProviderClass } from '../authz.provider';
import { PASSPORT_PROPERTY, SESSION_PASSPORT_KEY } from '../constants';
import { AuthzAnonymousError, AuthzError, AuthzVerificationError } from '../errors';
import {
  type AuthzMetaParams,
  getAllowAnonymous,
  getAlsStore,
  getContextAuthzMetaParamsList,
  getPassportProperty
} from '../utils';
import { createSessionAuthzGuard } from './session-authz.guard';
import type { SessionAuthzOptions } from './session-authz.interface';

const mockPayload = { userId: 1 };
const user = { id: 1, name: 'Test User' };
const mockedRequest = {
  [PASSPORT_PROPERTY]: undefined,
  session: {
    [SESSION_PASSPORT_KEY]: {
      user: mockPayload
    }
  }
};

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
  const AUTHZ_PROVIDER = 'AUTHZ_PROVIDER';
  const SESSION_AUTHZ_OPTIONS = 'SESSION_AUTHZ_OPTIONS';
  const ALS_PROVIDER = 'ALS_PROVIDER';
  const SESSION_META_KEY = 'SESSION_META_KEY';

  let store: Record<string, any>;

  let sessionAuthzGuard: InstanceType<ReturnType<typeof createSessionAuthzGuard>>;
  let reflector: Reflector;
  let mockAuthzProvider: Partial<AuthzProviderClass<unknown, unknown>>;
  let als: AsyncLocalStorage<any>;
  let sessionAuthzOptions: SessionAuthzOptions;

  beforeEach(async () => {
    store = { user, allowAnonymous: undefined, guardResult: undefined };
    jest.mocked(getAlsStore).mockReturnValue(store);

    reflector = new Reflector();
    mockAuthzProvider = {
      authorize: jest.fn().mockResolvedValue(true),
      authenticate: jest.fn().mockResolvedValue(user)
    };
    als = new AsyncLocalStorage();
    sessionAuthzOptions = {
      session: {
        secret: '123456'
      },
      defaultAllowAnonymous: true,
      passportProperty: 'property'
    } as unknown as SessionAuthzOptions;

    const SessionAuthzGuard = createSessionAuthzGuard([
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

  it('should throw error if AuthzProvider.authenticate is undefined', () => {
    const SessionAuthzGuard = createSessionAuthzGuard([
      AUTHZ_PROVIDER,
      SESSION_AUTHZ_OPTIONS,
      ALS_PROVIDER,
      SESSION_META_KEY
    ]);
    // @ts-ignore
    mockAuthzProvider.authenticate = undefined;

    expect(() => {
      new SessionAuthzGuard(reflector, mockAuthzProvider, sessionAuthzOptions, als);
    }).toThrow(AuthzError);
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

      expect(getAlsStore).toHaveBeenCalledTimes(3);
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
      expect(getPassportProperty).not.toHaveBeenCalled();
      expect(mockAuthzProvider.authorize).not.toHaveBeenCalled();

      expect(result).toBe(store.guardResult);
    });

    it('should call super.canActivate if AuthzMetaParams is empty', async () => {
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

      expect(getAllowAnonymous).toHaveBeenCalledTimes(1);
      expect(getAllowAnonymous).toHaveBeenCalledWith([], {
        defaultAllowAnonymous: sessionAuthzOptions.defaultAllowAnonymous
      });

      expect(store.allowAnonymous).toEqual(jest.mocked(getAllowAnonymous).mock.results[0].value);

      expect(getPassportProperty).toHaveBeenCalledTimes(1);
      expect(getPassportProperty).toHaveBeenCalledWith(mockedRequest);

      expect(mockAuthzProvider.authorize).not.toHaveBeenCalled();

      expect(store.guardResult).toBeUndefined();
      expect(result).toBe(true);
    });

    it('should bypass if public is true in the last AuthzMetaParams', async () => {
      sessionAuthzOptions.defaultAllowAnonymous = false;

      const contextParamsList = [
        { metaData: 'META_DATA_1' },
        { metaData: 'META_DATA_2', options: { public: true } }
      ] as AuthzMetaParams[];

      const mockedGetAll = jest.spyOn(reflector, 'getAll');
      mockedGetAll.mockReturnValueOnce(contextParamsList);

      mockAuthzProvider.authorize = jest.fn().mockResolvedValue(true);

      const context = createMockExecutionContext();

      const result = await sessionAuthzGuard.canActivate(context);

      expect(getAlsStore).toHaveBeenCalled();
      expect(mockedGetAll).toHaveBeenCalled();

      expect(getContextAuthzMetaParamsList).not.toHaveBeenCalled();
      expect(getAllowAnonymous).not.toHaveBeenCalled();
      expect(getPassportProperty).not.toHaveBeenCalled();
      expect(mockAuthzProvider.authorize).not.toHaveBeenCalled();

      expect(store.guardResult).toBe(true);
      expect(result).toBe(true);
    });

    it('should skip authorize method if user is not defined & allowAnonymous is true', async () => {
      sessionAuthzOptions.defaultAllowAnonymous = false;

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

    it('should skip authorize method if user is not defined & defaultAllowAnonymous is true', async () => {
      sessionAuthzOptions.defaultAllowAnonymous = true;

      const contextParamsList = [{ metaData: 'META_DATA_1' }, { metaData: 'META_DATA_2' }] as AuthzMetaParams[];

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

    it('should not skip authorize method if user is defined & allowAnonymous is true', async () => {
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
      };

      jest.mocked(mockAuthzProvider.authenticate!).mockResolvedValue(mockUser as never);

      const user = await sessionAuthzGuard.validate(req);

      expect(mockAuthzProvider.authenticate).toHaveBeenCalledTimes(1);
      expect(mockAuthzProvider.authenticate).toHaveBeenCalledWith(mockPayload, req);

      expect(getAlsStore).toHaveBeenCalledTimes(1);
      expect(getAlsStore).toHaveBeenCalledWith(als);

      expect(req[PASSPORT_PROPERTY]).toEqual(sessionAuthzOptions.passportProperty);
      expect(store.user).toEqual(mockUser);
      expect(user).toEqual([mockUser]);
    });

    it('should return AuthzAnonymousError if session user is not found', async () => {
      const req = { [PASSPORT_PROPERTY]: undefined };

      const [user, error] = await sessionAuthzGuard.validate(req);

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
      };

      jest.mocked(mockAuthzProvider.authenticate!).mockResolvedValue(mockUser as never);

      const [user, error] = await sessionAuthzGuard.validate(req);

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
      };

      jest.mocked(mockAuthzProvider.authenticate!).mockImplementation(
        jest.fn(() => {
          throw new Error('Verification failed');
        })
      );

      const [user, error] = await sessionAuthzGuard.validate(req);

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
      };

      jest.mocked(mockAuthzProvider.authenticate!).mockImplementation(
        jest.fn(() => {
          throw `Error`;
        })
      );

      const [user, error] = await sessionAuthzGuard.validate(req);

      expect(user).toBeNull();
      expect(error).toBeInstanceOf(AuthzVerificationError);
      expect(error.message).toBe(`Error`);
    });
  });
});
