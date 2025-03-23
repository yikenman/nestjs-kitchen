import { Get, Logger, StreamableFile } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { CACHE_KEY_METADATA, CACHE_MANAGER_SYMBOL, CACHE_TTL_METADATA, CACHE_VERBOSE_LOG } from '../cache.constants';
import { getMetadata, hashNoCoerce, isValidMethod } from '../utils';
import { CacheKey } from './cache-key.decorator';
import { CacheResult } from './cache-result.decorator';
import { CacheTTL } from './cache-ttl.decorator';

jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');
  return {
    ...actual,
    Inject: jest.fn(() => jest.fn()),
    Logger: {
      warn: jest.fn(),
      error: jest.fn()
    }
  };
});

jest.mock('../utils', () => {
  const actual = jest.requireActual('../utils');
  return {
    ...actual,
    getMetadata: jest.fn(actual.getMetadata),
    isValidMethod: jest.fn(actual.isValidMethod),
    hashNoCoerce: {
      hash: jest.fn(actual.hashNoCoerce.hash)
    }
  };
});

jest.mock('cache-manager', () => ({
  Cache: class MockCache {
    get = jest.fn();
    set = jest.fn();
  }
}));

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('CacheResult Decorator', () => {
  let cacheManager: Cache;

  beforeEach(() => {
    cacheManager = new (require('cache-manager').Cache)();
  });

  it('should apply cache and return cached value if available', async () => {
    jest.mocked(cacheManager.get).mockResolvedValue('cached-result');

    class TestClass {
      @CacheResult()
      async method() {
        return 'original-result';
      }

      [CACHE_MANAGER_SYMBOL] = cacheManager;
    }

    const instance = new TestClass();

    const result = await instance.method();
    expect(result).toBe('cached-result');
    expect(cacheManager.get).toHaveBeenCalled();
    expect(hashNoCoerce.hash).toHaveBeenCalled();
    expect(cacheManager.get).toHaveBeenCalledWith(
      `TestClass.method:${jest.mocked(hashNoCoerce.hash).mock.results[0].value}`
    );
    expect(cacheManager.set).not.toHaveBeenCalled();
  });

  it('should execute method if no cache value is found', async () => {
    jest.mocked(cacheManager.get).mockResolvedValue(null);

    class TestClass {
      @CacheResult()
      async method() {
        return 'original-result';
      }

      [CACHE_MANAGER_SYMBOL] = cacheManager;
    }

    const instance = new TestClass();

    const result = await instance.method();
    expect(result).toBe('original-result');
    expect(cacheManager.get).toHaveBeenCalled();
    expect(hashNoCoerce.hash).toHaveBeenCalled();
    expect(cacheManager.set).toHaveBeenCalledWith(
      `TestClass.method:${jest.mocked(hashNoCoerce.hash).mock.results[0].value}`,
      'original-result',
      undefined
    );
  });

  it('should generate correct cache key based on metadata', async () => {
    const mockKeyFactory = jest.fn().mockReturnValue('custom-key');

    class TestClass {
      @CacheKey(mockKeyFactory)
      @CacheResult()
      async method() {
        return 'computed-value';
      }

      [CACHE_MANAGER_SYMBOL] = cacheManager;
    }

    const instance = new TestClass();

    await instance.method();

    expect(getMetadata).toHaveBeenCalledWith(CACHE_KEY_METADATA, expect.any(Array));
    expect(cacheManager.get).toHaveBeenCalledWith('custom-key');
  });

  it('should insert cache with correct ttl and key based on metadata', async () => {
    const mockTTLFactory = jest.fn().mockReturnValue(1000);
    const mockKeyFactory = jest.fn().mockReturnValue('custom-key');

    jest.mocked(cacheManager.get).mockResolvedValue(null);
    jest.mocked(cacheManager.set).mockResolvedValue(true);

    class TestClass {
      @CacheTTL(mockTTLFactory)
      @CacheKey(mockKeyFactory)
      @CacheResult()
      async method() {
        return 'original-result';
      }

      [CACHE_MANAGER_SYMBOL] = cacheManager;
    }

    const instance = new TestClass();

    await instance.method();

    expect(getMetadata).toHaveBeenCalledWith(CACHE_TTL_METADATA, expect.any(Array));
    expect(getMetadata).toHaveBeenCalledWith(CACHE_KEY_METADATA, expect.any(Array));
    expect(cacheManager.set).toHaveBeenCalledWith(`custom-key`, 'original-result', 1000);
  });

  it('should throw error if applied multiple times on the same method', () => {
    expect(() => {
      class TestClass {
        @CacheResult()
        @CacheResult()
        async method() {
          return 'result';
        }

        [CACHE_MANAGER_SYMBOL] = cacheManager;
      }
    }).toThrow('Cannot apply CacheResult decorator on the same method multiple times.');
  });

  it('should handle errors gracefully and log warnings', async () => {
    jest.mocked(cacheManager.get).mockRejectedValue(new Error('Cache error'));
    cacheManager[CACHE_VERBOSE_LOG] = true;

    class TestClass {
      @CacheResult()
      async method() {
        return 'original-result';
      }

      [CACHE_MANAGER_SYMBOL] = cacheManager;
    }

    const instance = new TestClass();

    const result = await instance.method();
    expect(result).toBe('original-result');
    expect(cacheManager.get).toHaveBeenCalled();
    expect(cacheManager.set).not.toHaveBeenCalled();
    expect(Logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('An error has occurred when getting'),
      expect.any(String),
      expect.any(String)
    );
  });

  it('should handle errors when inserting into cache', async () => {
    jest.mocked(cacheManager.set).mockRejectedValue(new Error('Cache set error'));

    class TestClass {
      @CacheResult()
      async method() {
        return 'original-result';
      }

      [CACHE_MANAGER_SYMBOL] = cacheManager;
    }

    const instance = new TestClass();

    const result = await instance.method();

    expect(result).toBe('original-result');
    expect(cacheManager.get).toHaveBeenCalled();
    expect(cacheManager.set).toHaveBeenCalled();
    expect(Logger.error).toHaveBeenCalledWith(
      expect.stringContaining('An error has occurred when inserting'),
      expect.any(String),
      expect.any(String)
    );
  });

  it('should handle errors when applying on an invalid method and log warings', async () => {
    cacheManager[CACHE_VERBOSE_LOG] = true;

    class TestClass {
      @CacheResult()
      @Get('/test')
      async method() {
        return 'original-result';
      }

      [CACHE_MANAGER_SYMBOL] = cacheManager;
    }

    const instance = new TestClass();

    const result = await instance.method();

    expect(result).toBe('original-result');
    expect(isValidMethod).toHaveBeenCalled();
    expect(cacheManager.get).not.toHaveBeenCalled();
    expect(cacheManager.set).not.toHaveBeenCalled();
    expect(Logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(`"method: method" is not a normal method.`),
      expect.any(String)
    );
  });

  it('should handle empty key and log warnings', async () => {
    cacheManager[CACHE_VERBOSE_LOG] = true;

    class TestClass {
      //@ts-ignore
      @CacheKey('')
      @CacheResult()
      async method() {
        return 'original-result';
      }

      [CACHE_MANAGER_SYMBOL] = cacheManager;
    }

    const instance = new TestClass();

    const result = await instance.method();
    expect(result).toBe('original-result');
    expect(cacheManager.get).not.toHaveBeenCalled();
    expect(cacheManager.set).not.toHaveBeenCalled();
    expect(Logger.warn).toHaveBeenCalledWith(expect.stringContaining('Invalid cache key.'), expect.any(String));
  });

  it('should ignore StreamableFile', async () => {
    cacheManager[CACHE_VERBOSE_LOG] = true;

    class TestClass {
      @CacheResult()
      async method() {
        return new StreamableFile(Buffer.from(''));
      }

      [CACHE_MANAGER_SYMBOL] = cacheManager;
    }

    const instance = new TestClass();

    const result = await instance.method();
    expect(result).toBeInstanceOf(StreamableFile);
    expect(cacheManager.set).not.toHaveBeenCalled();
  });
});
