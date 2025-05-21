import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CsrfGuard } from './csrf.guard';
import { CsrfInvalidError, CsrfMismatchError, CsrfMissingError } from './errors';
import type { CsrfDoubleCsrfOptions, CsrfSessionOptions } from './types';
import { getAdaptorMethods } from './utils';

jest.mock('./utils', () => {
  const actual = jest.requireActual('./utils');
  return {
    ...actual,
    getAdaptorMethods: jest.fn()
  };
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('CsrfGuard', () => {
  let guard: CsrfGuard;
  let context: ExecutionContext;
  let reflector: Reflector;

  let tokens: {
    verify: jest.Mock<any, any, any>;
  };

  let mockHttpAdapterHost: {
    httpAdapter: {
      constructor: {
        name: string;
      };
    };
  };

  let mockMethods: {
    getHttpMethod: jest.Mock<any, any, any>;
    isCookieAvailable: jest.Mock<any, any, any>;
    isSessionAvailable: jest.Mock<any, any, any>;
    getCookie: jest.Mock<any, any, any>;
    getSession: jest.Mock<any, any, any>;
    getSessionId: jest.Mock<any, any, any>;
  };

  let mockRequest: {
    headers: {
      'x-csrf-token': string;
    };
    method: string;
    cookies: {};
    session: {};
  };

  let mockOptions: CsrfDoubleCsrfOptions | CsrfSessionOptions;

  beforeEach(() => {
    tokens = { verify: jest.fn() };

    mockHttpAdapterHost = {
      httpAdapter: { constructor: { name: 'ExpressAdapter' } }
    };

    mockMethods = {
      getHttpMethod: jest.fn((req) => (req.method as string).toUpperCase()),
      isCookieAvailable: jest.fn(),
      isSessionAvailable: jest.fn(),
      getCookie: jest.fn(),
      getSession: jest.fn(),
      getSessionId: jest.fn()
    };

    mockRequest = {
      headers: { 'x-csrf-token': 'test-token' },
      method: 'POST',
      cookies: {},
      session: {}
    };

    mockOptions = {
      type: 'double-csrf',
      cookieKey: '_csrf',
      // @ts-ignore
      sessionKey: '_csrf',
      cookieOptions: { signed: false },
      getToken: (req: any) => req.headers['x-csrf-token'],
      verifyMethodsSet: new Set(['POST', 'PUT']),
      oneTimeToken: false,
      nonceStore: {
        get: jest.fn(),
        del: jest.fn()
      }
    };

    context = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest)
      }),
      getHandler: jest.fn().mockReturnValue('getHandler'),
      getClass: jest.fn().mockReturnValue('getClass')
    } as unknown as ExecutionContext;

    reflector = new Reflector();

    // @ts-ignore
    jest.mocked(getAdaptorMethods).mockImplementation(() => mockMethods);
    jest.spyOn(reflector, 'getAll').mockReturnValue([false, false]);
    guard = new CsrfGuard(mockOptions as any, tokens as any, mockHttpAdapterHost as any, reflector);
    guard.onModuleInit();
  });

  describe('onModuleInit', () => {
    it('should initialize adaptor methods', () => {
      expect(() => guard.onModuleInit()).not.toThrow();
    });

    it('should throw error if adapter not supported', () => {
      // @ts-ignore
      jest.mocked(getAdaptorMethods).mockReturnValueOnce(undefined);

      const badGuard = new CsrfGuard(mockOptions as any, tokens as any, mockHttpAdapterHost as any, reflector);

      expect(() => badGuard.onModuleInit()).toThrow(
        `Unsupported HTTP adapter: cannot resolve method bindings for ${mockHttpAdapterHost.httpAdapter.constructor.name}.`
      );
    });
  });

  describe('isTargetMethod', () => {
    it('should return true if method type is in verifyMethodsSet', () => {
      expect(guard.isTargetMethod({ method: 'post' })).toBeTruthy();
    });
    it('should return false if method type is not in verifyMethodsSet', () => {
      expect(guard.isTargetMethod({ method: 'get' })).toBeFalsy();
    });
  });

  describe('shouldVerify()', () => {
    it('should return true for method in verifyMethodsSet', () => {
      expect(guard.shouldVerify(context, mockRequest)).toBe(true);
    });

    it('should return true if verify metadata present on handler', () => {
      jest.spyOn(reflector, 'getAll').mockImplementation((key) => {
        if (key === 'csrf:verify') return [false, true];
        return [false, false];
      });
      expect(guard.shouldVerify(context, mockRequest)).toBe(true);
    });

    it('should return false if noVerify metadata present on handler', () => {
      jest.spyOn(reflector, 'getAll').mockImplementation((key) => {
        if (key === 'csrf:no-verify') return [false, true];
        if (key === 'csrf:verify') return [true, false];
        return [false, false];
      });
      expect(guard.shouldVerify(context, mockRequest)).toBe(false);
    });

    it('should return false if sign metadata present on handler', () => {
      jest.spyOn(reflector, 'getAll').mockImplementation((key) => {
        if (key === 'csrf:sign') return [false, true];
        if (key === 'csrf:verify') return [true, false];
        return [false, false];
      });
      expect(guard.shouldVerify(context, mockRequest)).toBe(false);
    });

    it('should return false if noVerify metadata present on class', () => {
      jest.spyOn(reflector, 'getAll').mockImplementation((key) => {
        if (key === 'csrf:no-verify') return [true, false];
        if (key === 'csrf:verify') return [true, false];
        return [false, false];
      });
      expect(guard.shouldVerify(context, mockRequest)).toBe(false);
    });

    it('should return false if sign metadata present on class', () => {
      jest.spyOn(reflector, 'getAll').mockImplementation((key) => {
        if (key === 'csrf:sign') return [true, false];
        if (key === 'csrf:verify') return [true, false];
        return [false, false];
      });
      expect(guard.shouldVerify(context, mockRequest)).toBe(false);
    });
  });

  describe('getOneTimeTokenSecret()', () => {
    it('should return and delete nonce value', async () => {
      mockMethods.getSessionId.mockReturnValue('sid');
      const mockStore = {
        get: jest.fn().mockResolvedValue('stored-secret'),
        del: jest.fn().mockResolvedValue(undefined)
      };
      const opts = { ...mockOptions, nonceStore: mockStore };
      const result = await guard.getOneTimeTokenSecret(mockRequest, 'token1', opts as any);
      expect(result).toBe('stored-secret');
      expect(mockStore.del).toHaveBeenCalledWith('csrf:sid:token1');
    });

    it('should throw error if sessionId missing', async () => {
      mockMethods.getSessionId.mockReturnValue(undefined);
      await expect(guard.getOneTimeTokenSecret(mockRequest, 't', mockOptions as any)).rejects.toThrow(
        /Session ID not found/
      );
    });

    it('should throw error if nonceStore.get failed', async () => {
      const err = new Error(`nonceStore.get failed`);

      mockMethods.getSessionId.mockReturnValue('sid');
      const mockStore = {
        get: jest.fn().mockImplementationOnce(() => {
          throw err;
        }),
        del: jest.fn().mockResolvedValue(undefined)
      };
      const opts = { ...mockOptions, nonceStore: mockStore };
      await expect(guard.getOneTimeTokenSecret(mockRequest, 't', opts as any)).rejects.toThrow(err);
    });

    it('should throw error if nonceStore.del failed', async () => {
      const err = new Error(`nonceStore.del failed`);

      mockMethods.getSessionId.mockReturnValue('sid');
      const mockStore = {
        get: jest.fn().mockResolvedValue('stored-secret'),
        del: jest.fn().mockImplementationOnce(() => {
          throw err;
        })
      };
      const opts = { ...mockOptions, nonceStore: mockStore };
      await expect(guard.getOneTimeTokenSecret(mockRequest, 't', opts as any)).rejects.toThrow(err);
    });
  });

  describe('getSecret()', () => {
    it('should return cookie value in double-csrf mode', () => {
      mockMethods.isCookieAvailable.mockReturnValue(true);
      mockMethods.getCookie.mockReturnValue('secret-cookie');
      const secret = guard.getSecret(mockRequest, 'test-token');
      expect(secret).toBe('secret-cookie');
    });

    it('should throw error if cookie not available in double-csrf', () => {
      mockMethods.isCookieAvailable.mockReturnValue(false);
      expect(() => guard.getSecret(mockRequest, 't')).toThrow(/Cookie support is required/);
    });

    it('should return session value in session mode', () => {
      (guard as any).options.type = 'session';
      mockMethods.isSessionAvailable.mockReturnValue(true);
      mockMethods.getSession.mockReturnValue('session-secret');
      const secret = guard.getSecret(mockRequest, 'token');
      expect(secret).toBe('session-secret');
    });

    it('should call getOneTimeTokenSecret if oneTimeToken is true', async () => {
      (guard as any).options = { ...mockOptions, type: 'session', oneTimeToken: true };
      mockMethods.isSessionAvailable.mockReturnValue(true);
      const spy = jest.spyOn(guard, 'getOneTimeTokenSecret').mockResolvedValue('secret!');
      const result = await guard.getSecret(mockRequest, 'token');
      expect(result).toBe('secret!');
    });

    it('should throw error if session is not available in session mode', () => {
      (guard as any).options.type = 'session';
      mockMethods.isSessionAvailable.mockReturnValue(false);
      expect(() => guard.getSecret(mockRequest, 'token')).toThrow(/Session support is required/);
    });

    it('should return empty value in unavailable mode', () => {
      (guard as any).options.type = 'unavailable';
      const secret = guard.getSecret(mockRequest, 'token');
      expect(secret).toBe('');
    });
  });

  describe('canActivate()', () => {
    it('should pass if everything valid', async () => {
      mockMethods.isCookieAvailable.mockReturnValue(true);
      mockMethods.getCookie.mockReturnValue('secret-token');
      tokens.verify.mockReturnValue(true);
      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it('should pass if shouldVerify return false', async () => {
      mockRequest.method = 'get';
      await expect(guard.canActivate(context)).resolves.toBe(true);
    });

    it('should throw CsrfMissingError if token is missing', async () => {
      const badReq = { ...mockRequest, headers: {} };
      const badCtx = { ...context, switchToHttp: () => ({ getRequest: () => badReq }) };
      await expect(guard.canActivate(badCtx as any)).rejects.toThrow(CsrfMissingError);
    });

    it('should throw CsrfMismatchError if secret is missing', async () => {
      mockMethods.isCookieAvailable.mockReturnValue(true);
      mockMethods.getCookie.mockReturnValue(undefined);
      await expect(guard.canActivate(context)).rejects.toThrow(CsrfMismatchError);
    });

    it('should throw CsrfInvalidError if token verification fails', async () => {
      mockMethods.isCookieAvailable.mockReturnValue(true);
      mockMethods.getCookie.mockReturnValue('some-secret');
      tokens.verify.mockReturnValue(false);
      await expect(guard.canActivate(context)).rejects.toThrow(CsrfInvalidError);
    });
  });
});
