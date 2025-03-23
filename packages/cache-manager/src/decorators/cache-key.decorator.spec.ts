import { SetMetadata } from '@nestjs/common';
import { CACHE_KEY_METADATA } from '../cache.constants';
import { CacheKey } from './cache-key.decorator';

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

describe('CacheKey Decorator', () => {
  it('should set metadata for method decorator with string key', () => {
    class TestClass {
      @CacheKey('test-key')
      method() {}
    }

    expect(SetMetadata).toHaveBeenCalledWith(CACHE_KEY_METADATA, 'test-key');
  });

  it('should set metadata for method decorator with function key', () => {
    const keyFactory = jest.fn(() => 'computed-key');

    class TestClass {
      @CacheKey(keyFactory)
      method() {}
    }

    expect(SetMetadata).toHaveBeenCalledWith(CACHE_KEY_METADATA, keyFactory);
  });

  it('should set metadata for class decorator with function key', () => {
    const keyFactory = jest.fn(() => 'computed-class-key');

    @CacheKey(keyFactory)
    class TestClass {}

    expect(SetMetadata).toHaveBeenCalledWith(CACHE_KEY_METADATA, keyFactory);
  });

  it('should throw an error if key is nil (undefined or null)', () => {
    expect(() => {
      class TestClass {
        // @ts-ignore
        @CacheKey(undefined)
        method() {}
      }
    }).toThrow('CacheKey requires a valid key but received an empty or undefined value.');
  });

  it('should throw an error if string key is used at the class level', () => {
    expect(() => {
      // @ts-ignore
      @CacheKey('invalid-class-key')
      class TestClass {}
    }).toThrow('CacheKey cannot use a string key at the class level. Use a function instead.');
  });

  it('should not throw an error when function key is used at the class level', () => {
    expect(() => {
      @CacheKey(() => 'valid-class-key')
      class TestClass {}
    }).not.toThrow();
  });
});
