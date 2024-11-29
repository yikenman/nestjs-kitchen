import { AsyncLocalStorage } from 'node:async_hooks';
import { mixin } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthzProviderClass } from '../authz.provider';
import { AuthzError } from '../errors';
import { getAlsStore } from '../utils';
import { createSessionAuthzService } from './session-authz.service';

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
    getAlsStore: jest.fn(actual.getAlsStore)
  };
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('Session Authz Service', () => {
  const AUTHZ_PROVIDER = 'AUTHZ_PROVIDER';
  const ALS_PROVIDER = 'ALS_PROVIDER';

  let SessionAuthzService: ReturnType<typeof createSessionAuthzService>;

  let service: InstanceType<typeof SessionAuthzService>;
  let mockAuthzProvider: AuthzProviderClass<unknown, unknown>;
  let als: AsyncLocalStorage<any>;
  let user = { id: 1 };
  let payload = { userId: 1 };

  beforeEach(async () => {
    SessionAuthzService = createSessionAuthzService([AUTHZ_PROVIDER, ALS_PROVIDER]);

    mockAuthzProvider = {
      createPayload: jest.fn().mockResolvedValue(payload)
    } as unknown as AuthzProviderClass<unknown, unknown>;

    als = new AsyncLocalStorage();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionAuthzService,
        { provide: AUTHZ_PROVIDER, useValue: mockAuthzProvider },
        { provide: ALS_PROVIDER, useValue: als }
      ]
    }).compile();

    service = module.get<InstanceType<typeof SessionAuthzService>>(SessionAuthzService);
  });

  it('should call mixin', () => {
    expect(mixin).toHaveBeenCalledTimes(1);
  });

  describe('constructor', () => {
    it('should throw an AuthzError if authzProvider.createPayload is not a function', () => {
      expect(() => new SessionAuthzService({} as typeof mockAuthzProvider, als)).toThrow(
        new AuthzError(`InternalError: Method 'createPayload' from abstract class 'AuthzProvider' must be implemented.`)
      );
    });
  });

  describe('logIn', () => {
    it('should call logIn method from ALS store', async () => {
      const logInMock = jest.fn();
      als.getStore = jest.fn().mockReturnValue({ logIn: logInMock });

      await service.logIn(user);

      expect(getAlsStore).toHaveBeenCalledTimes(1);
      expect(getAlsStore).toHaveBeenCalledWith(als);

      expect(mockAuthzProvider.createPayload).toHaveBeenCalledTimes(1);
      expect(mockAuthzProvider.createPayload).toHaveBeenCalledWith(user);

      expect(logInMock).toHaveBeenCalledWith(payload);
    });
  });

  describe('logOut', () => {
    it('should call logOut method from ALS store', async () => {
      const logOutMock = jest.fn();
      als.getStore = jest.fn().mockReturnValue({ logOut: logOutMock });

      await service.logOut();

      expect(getAlsStore).toHaveBeenCalledTimes(1);
      expect(getAlsStore).toHaveBeenCalledWith(als);

      expect(logOutMock).toHaveBeenCalledWith();
    });
  });

  describe('setCookie', () => {
    it('should call setCookie method from ALS store', () => {
      const setCookieMock = jest.fn();
      als.getStore = jest.fn().mockReturnValue({ setCookie: setCookieMock });

      service.setCookie('name', 'value', { httpOnly: true });

      expect(getAlsStore).toHaveBeenCalledTimes(1);
      expect(getAlsStore).toHaveBeenCalledWith(als);

      expect(setCookieMock).toHaveBeenCalledWith('name', 'value', { httpOnly: true });
    });
  });

  describe('getUser', () => {
    it('should return user from ALS store', () => {
      als.getStore = jest.fn().mockReturnValue({ user: { id: 1 } });

      const user = service.getUser();

      expect(getAlsStore).toHaveBeenCalledTimes(1);
      expect(getAlsStore).toHaveBeenCalledWith(als);

      expect(user).toEqual({ id: 1 });
    });
  });
});
