import { CallHandler, ExecutionContext, Logger, StreamableFile } from '@nestjs/common';
import { HttpAdapterHost, Reflector } from '@nestjs/core';
import { Test, TestingModule } from '@nestjs/testing';
import { firstValueFrom, of } from 'rxjs';
import { CACHE_KEY_METADATA, CACHE_MANAGER, CACHE_TTL_METADATA, CACHE_VERBOSE_LOG } from '../cache.constants';
import { CacheInterceptor } from './cache.interceptor';

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('CacheInterceptor', () => {
  let cacheInterceptor: CacheInterceptor;
  let cacheManager: any;
  let reflector: Reflector;
  let httpAdapterHost: HttpAdapterHost;
  let httpAdapter: any;
  let mockContext: ExecutionContext;
  let mockNext: CallHandler;

  beforeEach(async () => {
    cacheManager = {
      get: jest.fn(),
      set: jest.fn()
    };

    //@ts-ignore
    reflector = {
      get: jest.fn()
    };
    httpAdapter = {
      getRequestMethod: jest.fn().mockReturnValue(true),
      getRequestUrl: jest.fn().mockReturnValue('test-path'),
      setHeader: jest.fn()
    };

    //@ts-ignore
    httpAdapterHost = { httpAdapter };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheInterceptor,
        { provide: CACHE_MANAGER, useValue: cacheManager },
        { provide: Reflector, useValue: reflector },
        { provide: HttpAdapterHost, useValue: httpAdapterHost }
      ]
    }).compile();

    cacheInterceptor = module.get<CacheInterceptor>(CacheInterceptor);

    mockContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ method: 'GET' }),
        getResponse: jest.fn().mockReturnValue({})
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
      getArgByIndex: jest.fn()
    } as unknown as ExecutionContext;

    mockNext = {
      handle: jest.fn().mockReturnValue(of('response-data'))
    };
  });

  it('should return cached value if found', async () => {
    jest.mocked(cacheManager.get).mockResolvedValueOnce('cached-response');

    const result = await firstValueFrom(await cacheInterceptor.intercept(mockContext, mockNext));

    expect(cacheManager.get).toHaveBeenCalled();
    expect(result).toBe('cached-response');
  });

  it('should call next.handle() if cache key is not found', async () => {
    jest.mocked(cacheManager.get).mockResolvedValueOnce(undefined);

    const result = await firstValueFrom(await cacheInterceptor.intercept(mockContext, mockNext));

    expect(mockNext.handle).toHaveBeenCalled();
    expect(result).toBe('response-data');
  });

  it('should cache the response if cache key exists', async () => {
    jest.mocked(cacheManager.get).mockResolvedValueOnce(undefined);
    jest.mocked(cacheManager.set).mockResolvedValueOnce(undefined);

    await firstValueFrom(await cacheInterceptor.intercept(mockContext, mockNext));

    expect(cacheManager.set).toHaveBeenCalledWith(expect.any(String), 'response-data');
  });

  it('should handle error when caching the response', async () => {
    jest.mocked(cacheManager.get).mockResolvedValueOnce(undefined);
    jest.mocked(cacheManager.set).mockRejectedValueOnce(new Error('error'));
    jest.spyOn(Logger, 'error').mockImplementation();

    const result = await firstValueFrom(await cacheInterceptor.intercept(mockContext, mockNext));

    expect(result).toBe('response-data');
    expect(cacheManager.set).toHaveBeenCalledWith(expect.any(String), 'response-data');
    expect(Logger.error).toHaveBeenCalledWith(
      expect.stringContaining(`An error has occurred when inserting "key: test-path"`),
      expect.anything(),
      'CacheInterceptor'
    );
  });

  it('should not cache StreamableFile responses', async () => {
    jest.mocked(mockNext.handle).mockReturnValue(of(new StreamableFile(Buffer.from('data'))));

    await firstValueFrom(await cacheInterceptor.intercept(mockContext, mockNext));

    expect(cacheManager.set).not.toHaveBeenCalled();
  });

  it('should use TTL if provided via metadata', async () => {
    jest.mocked(reflector.get).mockImplementation((key) => {
      if (key === CACHE_TTL_METADATA) {
        return 10;
      }
      return undefined;
    });
    jest.mocked(cacheManager.get).mockResolvedValueOnce(undefined);

    await firstValueFrom(await cacheInterceptor.intercept(mockContext, mockNext));

    expect(cacheManager.set).toHaveBeenCalledWith('test-path', 'response-data', 10);
  });

  it('should use TTL as factroy function if provided via metadata', async () => {
    jest.mocked(reflector.get).mockImplementation((key) => {
      if (key === CACHE_TTL_METADATA) {
        return async () => 10;
      }
      return undefined;
    });
    jest.mocked(cacheManager.get).mockResolvedValueOnce(undefined);

    await firstValueFrom(await cacheInterceptor.intercept(mockContext, mockNext));

    expect(cacheManager.set).toHaveBeenCalledWith('test-path', 'response-data', 10);
  });

  it('should handle errors gracefully and fall back to original method', async () => {
    cacheManager.get.mockRejectedValueOnce(new Error('Cache error'));
    cacheManager[CACHE_VERBOSE_LOG] = true;

    jest.spyOn(Logger, 'warn').mockImplementation();

    const result = await firstValueFrom(await cacheInterceptor.intercept(mockContext, mockNext));

    expect(Logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(`An error has occurred when getting "key: test-path"`),
      expect.anything(),
      'CacheInterceptor'
    );
    expect(result).toBe('response-data');
  });

  it('should handle key if provide via metadata', async () => {
    jest.mocked(reflector.get).mockImplementation((key) => {
      if (key === CACHE_KEY_METADATA) {
        return 'key';
      }
      return undefined;
    });
    jest.mocked(cacheManager.get).mockResolvedValueOnce(undefined);

    const result = await firstValueFrom(await cacheInterceptor.intercept(mockContext, mockNext));

    expect(cacheManager.get).toHaveBeenCalledWith('key');
    expect(result).toBe('response-data');
  });

  it('should handle empty key and fall back to original method', async () => {
    jest.mocked(reflector.get).mockImplementation((key) => {
      if (key === CACHE_KEY_METADATA) {
        return async () => '';
      }
      return undefined;
    });
    cacheManager[CACHE_VERBOSE_LOG] = true;

    jest.spyOn(Logger, 'warn').mockImplementation();

    const result = await firstValueFrom(await cacheInterceptor.intercept(mockContext, mockNext));

    expect(Logger.warn).toHaveBeenCalledWith(expect.stringContaining(`Invalid cache key.`), 'CacheInterceptor');
    expect(result).toBe('response-data');
  });

  it('should check if request method is cacheable', () => {
    mockContext.switchToHttp = jest.fn().mockReturnValue({
      getRequest: jest.fn().mockReturnValue({ method: 'POST' })
    });

    //@ts-ignore
    expect(cacheInterceptor.isRequestCacheable(mockContext)).toBe(false);
    //@ts-ignore
    expect(cacheInterceptor.trackBy(mockContext)).toBe(undefined);
  });

  it('should set headers correctly when cache is HIT', async () => {
    jest.mocked(cacheManager.get).mockResolvedValueOnce('cached-response');

    await firstValueFrom(await cacheInterceptor.intercept(mockContext, mockNext));

    expect(httpAdapter.setHeader).toHaveBeenCalledWith(expect.anything(), 'X-Cache', 'HIT');
  });

  it('should set headers correctly when cache is MISS', async () => {
    jest.mocked(cacheManager.get).mockResolvedValueOnce(undefined);

    await firstValueFrom(await cacheInterceptor.intercept(mockContext, mockNext));

    expect(httpAdapter.setHeader).toHaveBeenCalledWith(expect.anything(), 'X-Cache', 'MISS');
  });

  it('should not set headers when httpAdapterHost not existed', async () => {
    //@ts-ignore
    cacheInterceptor.httpAdapterHost = undefined;
    //@ts-ignore
    cacheInterceptor.setHeadersWhenHttp(mockContext, 'value');

    expect(mockContext.switchToHttp).not.toHaveBeenCalled();
  });

  it('should not set headers when httpAdapter not existed', async () => {
    //@ts-ignore
    cacheInterceptor.httpAdapterHost.httpAdapter = undefined;
    //@ts-ignore
    cacheInterceptor.setHeadersWhenHttp(mockContext, 'value');

    expect(mockContext.switchToHttp).not.toHaveBeenCalled();
  });

  it('should get key from metadata if not httpApp', async () => {
    jest.mocked(reflector.get).mockImplementation((key) => {
      if (key === CACHE_KEY_METADATA) {
        return 'key';
      }
      return undefined;
    });

    jest.mocked(httpAdapter.getRequestUrl).mockReturnValueOnce('');

    //@ts-ignore
    expect(cacheInterceptor.trackBy(mockContext)).toBe('key');
  });
});
