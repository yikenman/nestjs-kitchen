import KeyvRedis from '@keyv/redis';
import { KeyvAdapter, createCache } from 'cache-manager';
import Keyv from 'keyv';
import { CACHE_MANAGER, CACHE_RESULT_OPTIONS, CACHE_VERBOSE_LOG } from './cache.constants';
import { createCacheManager } from './cache.providers';

jest.mock('cache-manager', () => ({
  createCache: jest.fn(() => ({
    set: jest.fn(),
    get: jest.fn(),
    del: jest.fn(),
    reset: jest.fn()
  }))
}));

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('createCacheManager', () => {
  let cacheManagerProvider: {
    provide: string | symbol;
    useFactory: (options: any) => Promise<void>;
    inject: (string | symbol)[];
  };

  beforeEach(() => {
    //@ts-ignore
    cacheManagerProvider = createCacheManager();
  });

  it('should return a provider with CACHE_MANAGER token', async () => {
    expect(cacheManagerProvider.provide).toBe(CACHE_MANAGER);
  });

  it('should create cache manager with default options', async () => {
    const mockOptions = { ttl: 5000, verbose: true };
    const cacheManager = await cacheManagerProvider.useFactory(mockOptions);

    expect(createCache).toHaveBeenCalledWith({
      ttl: mockOptions.ttl,
      refreshThreshold: undefined,
      nonBlocking: undefined
    });
    expect(cacheManager).toBeDefined();
    //@ts-ignore
    expect(cacheManager.onModuleDestroy).toBeDefined();
    //@ts-ignore
    expect(cacheManager[CACHE_VERBOSE_LOG]).toBeDefined();
    //@ts-ignore
    expect(cacheManager[CACHE_RESULT_OPTIONS]).toBeDefined();
  });

  it('should use Keyv instances for stores if provided', async () => {
    const mockStore = new Keyv();
    const mockOptions = { stores: [mockStore], ttl: 10000 };
    const cacheManager = await cacheManagerProvider.useFactory(mockOptions);

    expect(createCache).toHaveBeenCalledWith(expect.objectContaining({ stores: [mockStore] }));
    expect(cacheManager).toBeDefined();
  });

  it('should use Keyv instance for stores if provided', async () => {
    const mockStore = new Keyv();
    const mockOptions = { stores: mockStore, ttl: 10000 };
    const cacheManager = await cacheManagerProvider.useFactory(mockOptions);

    expect(createCache).toHaveBeenCalledWith(expect.objectContaining({ stores: [mockStore] }));
    expect(cacheManager).toBeDefined();
  });

  it('should create Keyv instance for stores if adaptor is provided', async () => {
    const mockStore = new KeyvRedis('redis://localhost:6379');
    const mockOptions = { stores: mockStore, ttl: 10000 };
    const cacheManager = await cacheManagerProvider.useFactory(mockOptions);

    expect(cacheManager).toBeDefined();
  });

  it('should correctly assign verbose and algorithm options', async () => {
    const mockOptions = { argAlg: 'sha1', verbose: true, ttl: 5000 };
    const cacheManager = await cacheManagerProvider.useFactory(mockOptions);

    expect(cacheManager[CACHE_VERBOSE_LOG]).toBe(true);
    expect(cacheManager[CACHE_RESULT_OPTIONS]).toEqual({ alg: 'sha1' });
  });

  it('should properly handle onModuleDestroy lifecycle', async () => {
    const mockStore = new Keyv();
    jest.spyOn(mockStore, 'disconnect').mockResolvedValue(undefined);
    const mockOptions = { stores: [mockStore], ttl: 5000 };
    const cacheManager = await cacheManagerProvider.useFactory(mockOptions);
    //@ts-ignore
    await cacheManager.onModuleDestroy();

    expect(mockStore.disconnect).toHaveBeenCalled();
  });

  it('should properly handle onModuleDestroy when stores is null', async () => {
    const mockStore = new Keyv();
    jest.spyOn(mockStore, 'disconnect').mockResolvedValue(undefined);
    const mockOptions = { stores: null, ttl: 5000 };
    const cacheManager = await cacheManagerProvider.useFactory(mockOptions);
    //@ts-ignore
    await cacheManager.onModuleDestroy();

    expect(mockStore.disconnect).not.toHaveBeenCalled();
  });
});
