import { PATH_METADATA } from '@nestjs/common/constants';
import {
  CACHE_RESULT_METADATA,
  GRAPHQL_META_PREFIX,
  MICROSERVICES_META_PREFIX,
  WEBSOCKETS_META_PREFIX
} from './cache.constants';
import * as utils from './utils';

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

describe('Utility Functions', () => {
  describe('copyMethodMetadata', () => {
    it('should copy all metadata from one method to another', () => {
      const fromMethod = () => {};
      const toMethod = () => {};

      Reflect.defineMetadata('key1', 'value1', fromMethod);
      Reflect.defineMetadata('key2', { some: 'data' }, fromMethod);

      utils.copyMethodMetadata(fromMethod, toMethod);

      expect(Reflect.getMetadata('key1', toMethod)).toBe('value1');
      expect(Reflect.getMetadata('key2', toMethod)).toEqual({ some: 'data' });

      expect(Reflect.getMetadata('key1', fromMethod)).toBe('value1');
      expect(Reflect.getMetadata('key2', fromMethod)).toEqual({ some: 'data' });
    });

    it('should not throw an error if there is no metadata on the source method', () => {
      const fromMethod = () => {};
      const toMethod = () => {};

      expect(Reflect.getMetadataKeys(fromMethod)).toEqual([]);

      expect(() => utils.copyMethodMetadata(fromMethod, toMethod)).not.toThrow();

      expect(Reflect.getMetadataKeys(toMethod)).toEqual([]);
    });

    it('should handle copying metadata when methods have existing metadata', () => {
      const fromMethod = () => {};
      const toMethod = () => {};

      Reflect.defineMetadata('key1', 'value1', fromMethod);

      Reflect.defineMetadata('existingKey', 'existingValue', toMethod);

      utils.copyMethodMetadata(fromMethod, toMethod);

      expect(Reflect.getMetadata('key1', toMethod)).toBe('value1');
      expect(Reflect.getMetadata('existingKey', toMethod)).toBe('existingValue');
    });
  });

  describe('getCacheResultMetdata', () => {
    let mockTarget: {};

    beforeEach(() => {
      mockTarget = {};
    });

    it('should get cache result metadata if it exists', () => {
      Reflect.defineMetadata(CACHE_RESULT_METADATA, true, mockTarget);

      const metadata = utils.getCacheResultMetdata(mockTarget);
      expect(metadata).toBe(true);
    });

    it('should return undefined if cache result metadata does not exist', () => {
      const metadata = utils.getCacheResultMetdata(mockTarget);
      expect(metadata).toBeUndefined();
    });
  });

  describe('setCacheResultMetdata', () => {
    let mockTarget: {};

    beforeEach(() => {
      mockTarget = {};
    });

    it('should set result metadata metadata', () => {
      utils.setCacheResultMetdata(mockTarget);

      const metadata = Reflect.getMetadata(CACHE_RESULT_METADATA, mockTarget);
      expect(metadata).toBe(true);
    });
  });

  describe('isValidMethod', () => {
    it('should return true for methods without restricted metadata', () => {
      class TestClass {
        method() {}
      }

      expect(utils.isValidMethod(TestClass.prototype.method)).toBe(true);
    });

    it('should return false for methods with PATH_METADATA', () => {
      class TestClass {
        method() {}
      }
      Reflect.defineMetadata(PATH_METADATA, '/test', TestClass.prototype.method);

      expect(utils.isValidMethod(TestClass.prototype.method)).toBe(false);
    });

    it('should return false for methods with WEBSOCKETS_META_PREFIX metadata', () => {
      class TestClass {
        method() {}
      }
      Reflect.defineMetadata(`${WEBSOCKETS_META_PREFIX}event`, true, TestClass.prototype.method);

      expect(utils.isValidMethod(TestClass.prototype.method)).toBe(false);
    });

    it('should return false for methods with MICROSERVICES_META_PREFIX metadata', () => {
      class TestClass {
        method() {}
      }
      Reflect.defineMetadata(`${MICROSERVICES_META_PREFIX}handler`, true, TestClass.prototype.method);

      expect(utils.isValidMethod(TestClass.prototype.method)).toBe(false);
    });

    it('should return false for methods with GRAPHQL_META_PREFIX metadata', () => {
      class TestClass {
        method() {}
      }
      Reflect.defineMetadata(`${GRAPHQL_META_PREFIX}resolver`, true, TestClass.prototype.method);

      expect(utils.isValidMethod(TestClass.prototype.method)).toBe(false);
    });

    it('should return true for methods with unrelated metadata', () => {
      class TestClass {
        method() {}
      }
      Reflect.defineMetadata('custom-meta', 'value', TestClass.prototype.method);

      expect(utils.isValidMethod(TestClass.prototype.method)).toBe(true);
    });

    it('should return false if multiple invalid metadata keys exist', () => {
      class TestClass {
        method() {}
      }
      Reflect.defineMetadata(PATH_METADATA, '/test', TestClass.prototype.method);
      Reflect.defineMetadata(`${GRAPHQL_META_PREFIX}resolver`, true, TestClass.prototype.method);

      expect(utils.isValidMethod(TestClass.prototype.method)).toBe(false);
    });
  });

  describe('getMetadata', () => {
    const TEST_METADATA_KEY = 'test-metadata';

    it('should return undefined if no targets are provided', () => {
      expect(utils.getMetadata(TEST_METADATA_KEY)).toBeUndefined();
      expect(utils.getMetadata(TEST_METADATA_KEY, [])).toBeUndefined();
    });

    it('should return undefined if no target has the metadata', () => {
      class TestClass {}
      class AnotherClass {}

      expect(utils.getMetadata(TEST_METADATA_KEY, [TestClass, AnotherClass])).toBeUndefined();
    });

    it('should return metadata from the first target that has it', () => {
      class FirstClass {}
      class SecondClass {}
      class ThirdClass {}

      Reflect.defineMetadata(TEST_METADATA_KEY, 'value-from-second', SecondClass);
      Reflect.defineMetadata(TEST_METADATA_KEY, 'value-from-third', ThirdClass);

      expect(utils.getMetadata(TEST_METADATA_KEY, [FirstClass, SecondClass, ThirdClass])).toBe('value-from-second');
    });

    it('should return metadata if only one target has it', () => {
      class OnlyClass {}

      Reflect.defineMetadata(TEST_METADATA_KEY, 'only-value', OnlyClass);

      expect(utils.getMetadata(TEST_METADATA_KEY, [OnlyClass])).toBe('only-value');
    });

    it('should work with class instances as targets', () => {
      class TestClass {}
      const instance = new TestClass();
      Reflect.defineMetadata(TEST_METADATA_KEY, 'instance-value', instance);

      expect(utils.getMetadata(TEST_METADATA_KEY, [instance])).toBe('instance-value');
    });

    it('should return undefined if metadata is explicitly set to undefined', () => {
      class TestClass {}
      Reflect.defineMetadata(TEST_METADATA_KEY, undefined, TestClass);

      expect(utils.getMetadata(TEST_METADATA_KEY, [TestClass])).toBeUndefined();
    });
  });
});
