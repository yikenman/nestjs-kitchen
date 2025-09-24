import { applyDecorators, SetMetadata, UseInterceptors } from '@nestjs/common';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { of } from 'rxjs';
import { PROXY_METADATA_ENABLE, PROXY_METADATA_OPTIONS } from './constant';
import { ProxyInterceptor } from './proxy.interceptor';
import { proxyStore } from './proxy-store';

jest.mock('http-proxy-middleware');
jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');
  return {
    ...actual,
    applyDecorators: jest.fn(actual.applyDecorators),
    SetMetadata: jest.fn(actual.SetMetadata),
    UseInterceptors: jest.fn(actual.UseInterceptors)
  };
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('ProxyInterceptor', () => {
  let interceptor: ProxyInterceptor;
  let reflector: Reflector;
  let adapterHost: HttpAdapterHost;
  const moduleOptions = { target: 'http://localhost:3000' };

  beforeEach(() => {
    reflector = new Reflector();
    adapterHost = { httpAdapter: { constructor: { name: 'ExpressAdapter' } } } as any;

    interceptor = new ProxyInterceptor(adapterHost, reflector, moduleOptions);
  });

  describe('onModuleInit', () => {
    it('should set methods for supported adapter', () => {
      interceptor.onModuleInit();
      expect(interceptor['methods']).toBeDefined();
    });

    it('should throw error for unsupported adapter', () => {
      adapterHost = { httpAdapter: { constructor: { name: 'UnknownAdapter' } } } as any;
      interceptor = new ProxyInterceptor(adapterHost, reflector, moduleOptions);
      expect(() => interceptor.onModuleInit()).toThrow(/Unsupported HTTP adapter/);
    });
  });

  describe('getProxyInstance', () => {
    it('should create and cache proxy instance', () => {
      const key = {};
      // @ts-ignore
      jest.mocked(createProxyMiddleware).mockReturnValue('proxyInstance');

      const proxy = interceptor.getProxyInstance(key, { target: 'http://localhost' });
      expect(proxy).toBe('proxyInstance');
      expect(proxyStore.get(key)).toBe('proxyInstance');

      // should return cached instance next time
      const proxy2 = interceptor.getProxyInstance(key, { target: 'http://localhost' });
      expect(proxy2).toBe('proxyInstance');
      expect(createProxyMiddleware).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRawRequest / getRawResponse', () => {
    beforeEach(() => {
      interceptor.onModuleInit();
    });

    it('should return raw request and response for ExpressAdapter', () => {
      const context: any = {
        switchToHttp: () => ({
          getRequest: () => ({ foo: 'bar' }),
          getResponse: () => ({ baz: 'qux' })
        })
      };

      expect(interceptor.getRawRequest(context)).toEqual({ foo: 'bar' });
      expect(interceptor.getRawResponse(context)).toEqual({ baz: 'qux' });
    });

    it('should fallback to rawBody if present', () => {
      const context: any = {
        switchToHttp: () => ({
          getRequest: () => ({ rawBody: { hello: 'world' } }),
          getResponse: () => ({ baz: 'qux' })
        })
      };
      expect(interceptor.getRawRequest(context)).toEqual({ hello: 'world' });
    });
  });

  describe('intercept', () => {
    beforeEach(() => {
      interceptor.onModuleInit();
    });

    it('should skip proxy if mergedOptions is empty', (done) => {
      interceptor = new ProxyInterceptor(adapterHost, reflector, {});
      jest
        .spyOn(reflector, 'getAll')
        .mockReturnValueOnce([undefined, true])
        .mockReturnValue([{}, {}] as any);
      const next = { handle: () => of('ok') } as any;
      const context: any = {
        getClass: () => ({}),
        getHandler: () => {},
        switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) })
      };

      interceptor.intercept(context, next).subscribe((res) => {
        expect(res).toBe('ok');
        done();
      });
    });

    it('should skip proxy if proxy is not enabled', (done) => {
      interceptor = new ProxyInterceptor(adapterHost, reflector, {});
      jest
        .spyOn(reflector, 'getAll')
        .mockReturnValueOnce([undefined, undefined])
        .mockReturnValue([{}, {}] as any);
      const next = { handle: () => of('ok') } as any;
      const context: any = {
        getClass: () => ({}),
        getHandler: () => {},
        switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) })
      };

      interceptor.intercept(context, next).subscribe((res) => {
        expect(res).toBe('ok');
        done();
      });
    });

    it('should create proxy and call next.handle', (done) => {
      const proxyFn = jest.fn((req, res, cb) => cb());
      // @ts-ignore
      jest.spyOn(interceptor, 'getProxyInstance').mockReturnValue(proxyFn);
      jest
        .spyOn(reflector, 'getAll')
        .mockReturnValueOnce([undefined, true])
        .mockReturnValue([{}, { target: 'http://localhost' }] as any);

      const next = { handle: () => of('ok') } as any;
      const classObj = { classObj: 'classObj' };
      const handlerObj = { handlerObj: 'handlerObj' };
      const context: any = {
        getClass: () => classObj,
        getHandler: () => handlerObj,
        switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) })
      };

      interceptor.intercept(context, next).subscribe((res) => {
        expect(interceptor.getProxyInstance).toHaveBeenCalledWith(handlerObj, expect.any(Object));
        expect(proxyFn).toHaveBeenCalled();
        expect(res).toBe('ok');
        done();
      });
    });

    it('should create proxy for controller if methods did not provide options', (done) => {
      const proxyFn = jest.fn((req, res, cb) => cb());
      // @ts-ignore
      jest.spyOn(interceptor, 'getProxyInstance').mockReturnValue(proxyFn);
      jest
        .spyOn(reflector, 'getAll')
        .mockReturnValueOnce([undefined, true])
        .mockReturnValue([{ target: 'http://localhost' }, undefined] as any);

      const next = { handle: () => of('ok') } as any;
      const classObj = { classObj: 'classObj' };
      const handlerObj = { handlerObj: 'handlerObj' };
      const context: any = {
        getClass: () => classObj,
        getHandler: () => handlerObj,
        switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) })
      };

      interceptor.intercept(context, next).subscribe((res) => {
        expect(interceptor.getProxyInstance).toHaveBeenCalledWith(classObj, expect.any(Object));
        expect(proxyFn).toHaveBeenCalled();
        expect(res).toBe('ok');
        done();
      });
    });

    it('should call observer.error when proxy callback returns error', (done) => {
      interceptor.onModuleInit();

      // 模拟 proxy 函数触发错误
      const error = new Error('proxy error');
      const proxyFn = jest.fn((req, res, cb) => cb(error));
      // @ts-ignore
      jest.spyOn(interceptor, 'getProxyInstance').mockReturnValue(proxyFn);
      jest
        .spyOn(reflector, 'getAll')
        .mockReturnValueOnce([undefined, true])
        .mockReturnValue([{}, { target: 'http://localhost' }] as any);

      const next = { handle: () => of('ok') } as any;
      const context: any = {
        getClass: () => ({}),
        getHandler: () => {},
        switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) })
      };

      interceptor.intercept(context, next).subscribe({
        next: () => {
          done.fail('next should not be called');
        },
        error: (err) => {
          expect(err).toBe(error);
          done();
        }
      });
    });

    it('should merge module, controller, and handler options in correct order', (done) => {
      const controllerOptions = { changeOrigin: false, headers: { 'X-Controller': '2' } };
      const handlerOptions = { pathRewrite: { '^/api': '' }, headers: { 'X-Handler': '3' } };

      jest
        .spyOn(reflector, 'getAll')
        .mockReturnValueOnce([undefined, true])
        .mockReturnValue([controllerOptions, handlerOptions] as any);

      const next = { handle: () => of('ok') } as any;
      const context: any = {
        getClass: () => ({}),
        getHandler: () => {},
        switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) })
      };

      const proxyFn = jest.fn((req, res, cb) => cb());
      // @ts-ignore
      jest.spyOn(interceptor, 'getProxyInstance').mockImplementation((key, options) => {
        expect(options).toEqual({
          ...moduleOptions,
          ...controllerOptions,
          ...handlerOptions
        });
        return proxyFn;
      });

      interceptor.intercept(context, next).subscribe({
        next: (res) => {
          expect(proxyFn).toHaveBeenCalled();
          expect(res).toBe('ok');
          done();
        },
        error: done.fail
      });
    });

    it('should shallow merge options', (done) => {
      const controllerOptions = { headers: { 'X-Controller': '2' } };
      const handlerOptions = { headers: { 'X-Handler': '3' } };

      jest
        .spyOn(reflector, 'getAll')
        .mockReturnValueOnce([undefined, true])
        .mockReturnValue([controllerOptions, handlerOptions] as any);

      const next = { handle: () => of('ok') } as any;
      const context: any = {
        getClass: () => ({}),
        getHandler: () => {},
        switchToHttp: () => ({ getRequest: () => ({}), getResponse: () => ({}) })
      };

      const proxyFn = jest.fn((req, res, cb) => cb());
      // @ts-ignore
      jest.spyOn(interceptor, 'getProxyInstance').mockImplementation((key, options) => {
        expect(options).toEqual({
          ...moduleOptions,
          headers: { 'X-Handler': '3' }
        });
        return proxyFn;
      });

      interceptor.intercept(context, next).subscribe({
        next: (res) => {
          expect(proxyFn).toHaveBeenCalled();
          done();
        },
        error: done.fail
      });
    });
  });

  describe('static methods', () => {
    it('Options should call SetMetadata', () => {
      const options = { target: 'http://localhost' };
      const result = ProxyInterceptor.Options(options);
      expect(result).toBeDefined();
      expect(SetMetadata).toHaveBeenCalled();
      expect(SetMetadata).toHaveBeenCalledWith(PROXY_METADATA_OPTIONS, options);
      expect(SetMetadata).toHaveBeenCalledWith(PROXY_METADATA_ENABLE, true);
    });

    it('Use should call SetMetadata and UseInterceptors', () => {
      const options = { target: 'http://localhost' };
      const result = ProxyInterceptor.Use(options);
      expect(result).toBeDefined();
      expect(SetMetadata).toHaveBeenCalled();
      expect(SetMetadata).toHaveBeenCalledWith(PROXY_METADATA_OPTIONS, options);
      expect(SetMetadata).toHaveBeenCalledWith(PROXY_METADATA_ENABLE, true);
      expect(UseInterceptors).toHaveBeenCalled();
      expect(UseInterceptors).toHaveBeenCalledWith(ProxyInterceptor);
      expect(applyDecorators).toHaveBeenCalled();
      expect(applyDecorators).toHaveBeenCalledWith(
        jest.mocked(SetMetadata).mock.results[0].value,
        jest.mocked(SetMetadata).mock.results[1].value,
        jest.mocked(UseInterceptors).mock.results[0].value
      );
    });
  });
});
