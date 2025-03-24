import { DynamicModule } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from './cache.constants';
import { Cache, CacheModule } from './cache.module';
import { createCacheManager } from './cache.providers';

jest.mock('./cache.providers', () => {
  const actual = jest.requireActual('./cache.providers');
  return {
    createCacheManager: jest.fn(actual.createCacheManager)
  };
});

describe('CacheModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [CacheModule.register()]
    }).compile();
  });

  afterEach(async () => {
    await module.close();
  });

  it('should provide CACHE_MANAGER and Cache', async () => {
    const cacheManager = module.get(CACHE_MANAGER);
    const cache = module.get(Cache);

    expect(createCacheManager).toHaveBeenCalled();
    expect(cacheManager).toBeDefined();
    expect(cache).toBe(cacheManager);
  });

  it('should register statically with options', async () => {
    const dynamicModule: DynamicModule = CacheModule.register({ isGlobal: true, ttl: 1000 });

    expect(dynamicModule.global).toBe(true);
    expect(dynamicModule.module).toBe(CacheModule);
  });

  it('should register dynamically with async options', async () => {
    const asyncOptions = {
      isGlobal: true,
      useFactory() {
        return {
          ttl: 1000
        };
      }
    };

    const dynamicModule: DynamicModule = CacheModule.registerAsync(asyncOptions);

    expect(dynamicModule.global).toBe(true);
    expect(dynamicModule.module).toBe(CacheModule);
    expect(dynamicModule.providers?.length).toBe(1);
  });

  it('should include extra providers when registerAsync is used', async () => {
    const asyncOptions = {
      useFactory() {
        return {
          ttl: 1000
        };
      },
      extraProviders: [{ provide: 'EXTRA_PROVIDER', useValue: 'extra-value' }]
    };

    const dynamicModule: DynamicModule = CacheModule.registerAsync(asyncOptions);

    expect(dynamicModule.providers).toContainEqual({
      provide: 'EXTRA_PROVIDER',
      useValue: 'extra-value'
    });
    expect(dynamicModule.providers?.length).toBe(2);
  });
});
