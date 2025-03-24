import { SetMetadata } from '@nestjs/common';
import { CACHE_TTL_METADATA } from '../cache.constants';
import { CacheTTL } from './cache-ttl.decorator';

jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');
  return {
    ...actual,
    SetMetadata: jest.fn(() => jest.fn())
  };
});

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
});

describe('CacheTTL Decorator', () => {
  it('should set metadata for method decorator with number TTL', () => {
    class TestClass {
      @CacheTTL(60)
      method() {}
    }

    expect(SetMetadata).toHaveBeenCalledWith(CACHE_TTL_METADATA, 60);
  });

  it('should set metadata for method decorator with function TTL', () => {
    const ttlFactory = jest.fn(() => 120);

    class TestClass {
      @CacheTTL(ttlFactory)
      method() {}
    }

    expect(SetMetadata).toHaveBeenCalledWith(CACHE_TTL_METADATA, ttlFactory);
  });

  it('should set metadata for class decorator with function TTL', () => {
    const ttlFactory = jest.fn(() => 180);

    @CacheTTL(ttlFactory)
    class TestClass {}

    expect(SetMetadata).toHaveBeenCalledWith(CACHE_TTL_METADATA, ttlFactory);
  });

  it('should throw an error if ttl is nil (undefined or null)', () => {
    expect(() => {
      class TestClass {
        // @ts-ignore
        @CacheTTL(undefined)
        method() {}
      }
    }).toThrow('CacheTTL requires a valid ttl but received an empty or undefined value.');
  });

  it('should not throw an error when function TTL is used at the class level', () => {
    expect(() => {
      @CacheTTL(() => 200)
      class TestClass {}
    }).not.toThrow();
  });
});
