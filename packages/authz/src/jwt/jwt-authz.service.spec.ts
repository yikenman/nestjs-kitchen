import { AsyncLocalStorage } from 'node:async_hooks';
import { mixin } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import jwt from 'jsonwebtoken';
import { AuthzProviderClass } from '../authz.provider';
import { JwtValidationType } from '../constants';
import { AuthzError } from '../errors';
import { encodeMsgpackrString, getAlsStore } from '../utils';
import type { JwtAuthzOptions } from './jwt-authz.interface';
import { createJwtAuthzService } from './jwt-authz.service';

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
    sign: jest.fn()
  };
});

jest.mock('../utils', () => {
  const actual = jest.requireActual('../utils');
  return {
    ...actual,
    encodeMsgpackrString: jest.fn(actual.encodeMsgpackrString),
    getAlsStore: jest.fn(actual.getAlsStore)
  };
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('JWT Authz Service', () => {
  const AUTHZ_PROVIDER = 'AUTHZ_PROVIDER';
  const JWT_AUTHZ_OPTIONS = 'JWT_AUTHZ_OPTIONS';
  const ALS_PROVIDER = 'ALS_PROVIDER';

  let JwtAuthzService: ReturnType<typeof createJwtAuthzService>;

  let service: InstanceType<typeof JwtAuthzService>;
  let mockAuthzProvider: AuthzProviderClass<unknown, unknown>;
  let als: AsyncLocalStorage<any>;
  let jwtAuthzOptions: JwtAuthzOptions;
  let user = { id: 1 };
  let payload = { userId: 1 };

  beforeEach(async () => {
    jest.mocked(jwt.sign).mockReset();

    JwtAuthzService = createJwtAuthzService([AUTHZ_PROVIDER, JWT_AUTHZ_OPTIONS, ALS_PROVIDER]);

    mockAuthzProvider = {
      createPayload: jest.fn().mockResolvedValue(payload)
    } as unknown as AuthzProviderClass<unknown, unknown>;

    jwtAuthzOptions = {
      jwt: {
        secretOrPrivateKey: 'test-secret',
        sign: { expiresIn: '1h' }
      },
      refresh: {
        secretOrPrivateKey: 'refresh-secret',
        sign: { expiresIn: '7d' }
      }
    } as unknown as JwtAuthzOptions;

    als = new AsyncLocalStorage();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAuthzService,
        { provide: AUTHZ_PROVIDER, useValue: mockAuthzProvider },
        { provide: JWT_AUTHZ_OPTIONS, useValue: jwtAuthzOptions },
        { provide: ALS_PROVIDER, useValue: als }
      ]
    }).compile();

    service = module.get<InstanceType<typeof JwtAuthzService>>(JwtAuthzService);
  });

  it('should call mixin', () => {
    expect(mixin).toHaveBeenCalledTimes(1);
  });

  describe('constructor', () => {
    it('should throw an AuthzError if authzProvider.createPayload is not a function', () => {
      expect(() => new JwtAuthzService({} as typeof mockAuthzProvider, jwtAuthzOptions, als)).toThrow(
        new AuthzError(`InternalError: Method 'createPayload' from abstract class 'AuthzProvider' must be implemented.`)
      );
    });
    it('should throw an AuthzError if jwtAuthzOptions.jwt.sign is not defined', () => {
      expect(() => new JwtAuthzService(mockAuthzProvider, { jwt: {} } as JwtAuthzOptions, als)).toThrow(
        new AuthzError(`InternalError: Missing JWT sign options.`)
      );
    });
    it('should throw an AuthzError if jwtAuthzOptions.refresh is defined but jwtAuthzOptions.refresh.sign is not defined', () => {
      expect(
        () => new JwtAuthzService(mockAuthzProvider, { jwt: { sign: {} }, refresh: {} } as JwtAuthzOptions, als)
      ).toThrow(new AuthzError(`InternalError: Missing Refresh sign options.`));
    });
  });

  describe('logIn', () => {
    it('should generate token and refresh when having jwtAuthzOptions.jwt and jwtAuthzOptions.refresh', async () => {
      // @ts-ignore
      jest.mocked(jwt.sign).mockReturnValueOnce('token').mockReturnValueOnce('refresh');

      const result = await service.logIn(user);

      expect(mockAuthzProvider.createPayload).toHaveBeenCalledWith(user);
      expect(jwt.sign).toHaveBeenCalledTimes(2);
      expect(jwt.sign).toHaveBeenNthCalledWith(
        1,
        payload,
        jwtAuthzOptions.jwt.secretOrPrivateKey,
        jwtAuthzOptions.jwt.sign
      );

      expect(encodeMsgpackrString).toHaveBeenCalledWith(payload);
      expect(jwt.sign).toHaveBeenNthCalledWith(
        2,
        { data: jest.mocked(encodeMsgpackrString).mock.results[0].value },
        jwtAuthzOptions?.refresh?.secretOrPrivateKey,
        jwtAuthzOptions?.refresh?.sign
      );

      expect(result).toEqual({ token: 'token', refresh: 'refresh' });
    });

    it('should generate token when only having jwtAuthzOptions.jwt', async () => {
      // @ts-ignore
      jest.mocked(jwt.sign).mockReturnValueOnce('token').mockReturnValueOnce('refresh');

      delete jwtAuthzOptions.refresh;

      const result = await service.logIn(user);

      expect(mockAuthzProvider.createPayload).toHaveBeenCalledWith(user);
      expect(jwt.sign).toHaveBeenCalledTimes(1);
      expect(jwt.sign).toHaveBeenNthCalledWith(
        1,
        payload,
        jwtAuthzOptions.jwt.secretOrPrivateKey,
        jwtAuthzOptions.jwt.sign
      );

      expect(encodeMsgpackrString).not.toHaveBeenCalled();

      expect(result).toEqual({ token: 'token' });
    });
  });

  describe('refresh', () => {
    it('should generate a new token', async () => {
      // @ts-ignore
      jest.mocked(jwt.sign).mockReturnValueOnce('newToken');

      als.getStore = jest.fn().mockReturnValue({ user: { id: 1 }, jwtVerifiedBy: JwtValidationType.REFRESH });

      const result = await service.refresh();

      expect(getAlsStore).toHaveBeenCalledTimes(1);
      expect(getAlsStore).toHaveBeenCalledWith(als);

      expect(mockAuthzProvider.createPayload).toHaveBeenCalledWith({ id: 1 });
      expect(result).toEqual({ token: 'newToken' });
    });

    it('should respect user parameter if have', async () => {
      // @ts-ignore
      jest.mocked(jwt.sign).mockReturnValueOnce('newToken');

      als.getStore = jest.fn().mockReturnValue({ user: { id: 1 }, jwtVerifiedBy: JwtValidationType.REFRESH });

      const result = await service.refresh({ id: 2 });

      expect(getAlsStore).not.toHaveBeenCalled();

      expect(mockAuthzProvider.createPayload).toHaveBeenCalledWith({ id: 2 });
      expect(result).toEqual({ token: 'newToken' });
    });

    it('should throw an error if user is not defined in ALS store', async () => {
      als.getStore = jest.fn().mockReturnValue({ jwtVerifiedBy: JwtValidationType.REFRESH });

      await expect(service.refresh()).rejects.toThrow(new AuthzError(`ParameterError: User data is undefined.`));
    });

    it('should throw an error if refresh is called outside @Refresh context', async () => {
      als.getStore = jest.fn().mockReturnValue({ user: { id: 1 }, jwtVerifiedBy: JwtValidationType.JWT });

      await expect(service.refresh()).rejects.toThrow(
        new AuthzError(
          `InvocationError: Calling 'refresh' method without user parameter can only be called under @Refresh().`
        )
      );
    });

    it('should return undefined if jwtAuthzOptions.refresh is not defined', async () => {
      delete jwtAuthzOptions.refresh;

      jest.spyOn(console, 'warn').mockImplementation(jest.fn);

      const result = await service.refresh();

      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(result).toBeUndefined();
    });
  });

  describe('setCookie', () => {
    it('should call setCookie from ALS store', () => {
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
