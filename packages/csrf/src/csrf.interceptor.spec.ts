import { rejects } from 'assert';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import Tokens from 'csrf';
import { lastValueFrom, of } from 'rxjs';
import { DEFAULT_KEY } from './constants';
import { CsrfInterceptor } from './csrf.interceptor';
import type { CsrfDoubleCsrfOptions, CsrfOptions, CsrfSessionOptions } from './types';
import { getAdaptorMethods } from './utils';

jest.mock('csrf');
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

describe('CsrfInterceptor', () => {
  let mockReq: any;
  let mockRes: any;
  let mockContext: ExecutionContext;
  let reflector: Reflector;
  let tokens: Tokens;
  let mockHttpAdapterHost: {
    httpAdapter: {
      constructor: {
        name: string;
      };
    };
  };
  let mockOptions: CsrfDoubleCsrfOptions | CsrfSessionOptions;
  let mockMethods: {
    isSessionAvailable: jest.Mock<any, any, any>;
    setSession: jest.Mock<any, any, any>;
    setHeader: jest.Mock<any, any, any>;
    isCookieAvailable: jest.Mock<any, any, any>;
    setCookie: jest.Mock<any, any, any>;
    getSessionId: jest.Mock<any, any, any>;
  };
  let interceptor: CsrfInterceptor;

  beforeEach(() => {
    mockReq = {};
    mockRes = {};
    mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockReq,
        getResponse: () => mockRes
      }),
      getClass: () => class {},
      getHandler: () => () => {}
    } as unknown as ExecutionContext;

    reflector = new Reflector();
    tokens = new Tokens();
    mockHttpAdapterHost = {
      httpAdapter: {
        constructor: {
          name: 'MockAdapter'
        }
      }
    };

    mockOptions = {
      type: 'session',
      sessionKey: '_csrf',
      headerKey: 'x-csrf-token',
      oneTimeToken: false,
      oneTimeTokenTTL: 300,
      // @ts-ignore
      nonceStore: {
        set: jest.fn()
      },
      cookieKey: '',
      cookieOptions: {}
    };

    mockMethods = {
      isSessionAvailable: jest.fn().mockReturnValue(true),
      setSession: jest.fn(),
      setHeader: jest.fn(),
      isCookieAvailable: jest.fn().mockReturnValue(true),
      setCookie: jest.fn(),
      getSessionId: jest.fn().mockReturnValue('sessionId123')
    };

    // @ts-ignore
    jest.mocked(getAdaptorMethods).mockReturnValue(mockMethods);
    interceptor = new CsrfInterceptor(mockOptions as any, tokens, mockHttpAdapterHost as any, reflector);
    interceptor.onModuleInit();
  });

  describe('onModuleInit', () => {
    it('should initialize adaptor methods', () => {
      expect(() => interceptor.onModuleInit()).not.toThrow();
    });

    it('should throw error if adapter not supported', () => {
      // @ts-ignore
      jest.mocked(getAdaptorMethods).mockReturnValueOnce(undefined);

      const badGuard = new CsrfInterceptor(mockOptions as any, tokens, mockHttpAdapterHost as any, reflector);

      expect(() => badGuard.onModuleInit()).toThrow(
        `Unsupported HTTP adapter: cannot resolve method bindings for ${mockHttpAdapterHost.httpAdapter.constructor.name}.`
      );
    });
  });

  describe('setOneTimeTokenSecret()', () => {
    it('should throw error if sessionId not found', () => {
      jest.mocked(mockMethods.getSessionId).mockReturnValue(undefined);

      expect(() =>
        interceptor.setOneTimeTokenSecret(mockReq, '', '', mockOptions as Required<CsrfSessionOptions & CsrfOptions>)
      ).rejects.toThrow(/Session ID not found/);
    });

    it('should throw error if nonceStore.set failed', () => {
      const err = new Error('test');
      jest.mocked((mockOptions as Required<CsrfSessionOptions & CsrfOptions>).nonceStore.set).mockRejectedValue(err);

      expect(() =>
        interceptor.setOneTimeTokenSecret(mockReq, '', '', mockOptions as Required<CsrfSessionOptions & CsrfOptions>)
      ).rejects.toThrow(err);
    });
  });

  describe('intercept()', () => {
    it('should not sign if CSRF_METADATA_SIGN is not set', (done) => {
      jest.spyOn(reflector, 'getAll').mockReturnValue([false, false]);
      const handler = { handle: () => of('test') };

      interceptor.intercept(mockContext, handler).subscribe((result) => {
        expect(result).toBe('test');
        expect(mockMethods.setSession).not.toHaveBeenCalled();
        done();
      });
    });

    it('should sign and set CSRF token and session', (done) => {
      jest.spyOn(reflector, 'getAll').mockReturnValue([false, true]);
      // @ts-ignore
      jest.spyOn(tokens, 'secret').mockResolvedValue('secret123');
      jest.spyOn(tokens, 'create').mockReturnValue('token123');

      const handler = { handle: () => of('response') };

      interceptor.intercept(mockContext, handler).subscribe(async (result) => {
        expect(result).toBe('response');
        expect(mockMethods.setSession).toHaveBeenCalledWith(mockReq, '_csrf', 'secret123');
        expect(mockMethods.setHeader).toHaveBeenCalledWith(mockRes, 'x-csrf-token', 'token123');
        done();
      });
    });

    it('should call nonceStore.set if oneTimeToken is true', (done) => {
      ((mockOptions as Required<CsrfSessionOptions>).oneTimeToken as boolean) = true;

      interceptor = new CsrfInterceptor(mockOptions as any, tokens, mockHttpAdapterHost as any, reflector);
      interceptor.onModuleInit();

      jest.spyOn(reflector, 'getAll').mockReturnValue([true, true]);
      // @ts-ignore
      jest.spyOn(tokens, 'secret').mockResolvedValue('secret123');
      jest.spyOn(tokens, 'create').mockReturnValue('token123');

      const handler = { handle: () => of('response') };

      interceptor.intercept(mockContext, handler).subscribe((result) => {
        expect(mockMethods.setSession).toHaveBeenCalledWith(mockReq, '_csrf', true);
        expect((mockOptions as Required<CsrfSessionOptions>).nonceStore.set).toHaveBeenCalled();
        done();
      });
    });

    it('should throw error if session not available in session mode', async () => {
      mockMethods.isSessionAvailable.mockReturnValue(false);
      jest.spyOn(reflector, 'getAll').mockReturnValue([false, true]);
      // @ts-ignore
      jest.spyOn(tokens, 'secret').mockResolvedValue('secret123');
      jest.spyOn(tokens, 'create').mockReturnValue('token123');

      const handler = { handle: () => of('test') };

      await expect(() => lastValueFrom(interceptor.intercept(mockContext, handler))).rejects.toThrow(
        /Session support is required/
      );
    });

    it('should set cookie if in double-csrf mode', (done) => {
      mockOptions.type = 'double-csrf';
      (mockOptions as Required<CsrfDoubleCsrfOptions>).cookieKey = DEFAULT_KEY;
      (mockOptions as Required<CsrfDoubleCsrfOptions>).cookieOptions = {};
      jest.spyOn(reflector, 'getAll').mockReturnValue([false, true]);
      // @ts-ignore
      jest.spyOn(tokens, 'secret').mockResolvedValue('cookie-secret');
      jest.spyOn(tokens, 'create').mockReturnValue('cookie-token');

      const handler = { handle: () => of('ok') };

      interceptor.intercept(mockContext, handler).subscribe((result) => {
        expect(mockMethods.setCookie).toHaveBeenCalledWith(
          mockRes,
          (mockOptions as Required<CsrfDoubleCsrfOptions>).cookieKey,
          'cookie-secret',
          (mockOptions as Required<CsrfDoubleCsrfOptions>).cookieOptions
        );
        expect(mockMethods.setHeader).toHaveBeenCalledWith(mockRes, 'x-csrf-token', 'cookie-token');
        done();
      });
    });

    it('should throw error if session not available in session mode', async () => {
      mockOptions.type = 'double-csrf';
      mockMethods.isCookieAvailable.mockReturnValue(false);
      jest.spyOn(reflector, 'getAll').mockReturnValue([false, true]);
      // @ts-ignore
      jest.spyOn(tokens, 'secret').mockResolvedValue('secret123');
      jest.spyOn(tokens, 'create').mockReturnValue('token123');

      const handler = { handle: () => of('test') };

      await expect(() => lastValueFrom(interceptor.intercept(mockContext, handler))).rejects.toThrow(
        /Cookie support is required/
      );
    });

    it('should do nothing if in other mode', (done) => {
      // @ts-ignore
      mockOptions.type = 'other';
      jest.spyOn(reflector, 'getAll').mockReturnValue([false, true]);
      // @ts-ignore
      jest.spyOn(tokens, 'secret').mockResolvedValue('cookie-secret');
      jest.spyOn(tokens, 'create').mockReturnValue('cookie-token');

      const handler = { handle: () => of('ok') };

      interceptor.intercept(mockContext, handler).subscribe((result) => {
        expect(mockMethods.setCookie).not.toHaveBeenCalled();
        expect(mockMethods.setHeader).not.toHaveBeenCalled();
        done();
      });
    });
  });
});
