import 'reflect-metadata';
import { DuckDBError } from './errors';
import * as utils from './utils';

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

describe('Utility Functions', () => {
  describe('truncateString', () => {
    it('should truncate long strings', () => {
      const input = 'abcdefghijklmnopqrstuvwxyz';
      const result = utils.truncateString(input, 10);
      expect(result).toBe('abcdefg...');
    });

    it('should return the original string if within maxLength', () => {
      expect(utils.truncateString('abc', 5)).toBe('abc');
    });

    it("should return '...' if maxLength is less then or equals 3", () => {
      expect(utils.truncateString('abccc', 3)).toBe('...');
    });
  });

  describe('printTable', () => {
    it('should return formatted table string', () => {
      const input = { key1: 'value1', key2: 'value2' };
      const result = utils.printTable(input);
      expect(result).toBe(`┌────────────────┬────────────────────────────────────────────┐
│ key1           │ value1                                     │
│ key2           │ value2                                     │
└────────────────┴────────────────────────────────────────────┘`);
    });

    it('should filter empty data', () => {
      const input = { key1: 'value1', key2: null };
      const result = utils.printTable(input);
      expect(result).toBe(`┌────────────────┬────────────────────────────────────────────┐
│ key1           │ value1                                     │
└────────────────┴────────────────────────────────────────────┘`);
    });
  });

  describe('createDebugLogger', () => {
    const mockLogger = jest.fn();
    const spyPrintTable = jest.spyOn(utils, 'printTable');

    it('should use custom formatter if provided', () => {
      const customFormatter = jest.fn().mockReturnValue('Formatted log');
      const logger = utils.createDebugLogger(mockLogger, customFormatter);

      logger({ key: 'value' });

      expect(customFormatter).toHaveBeenCalledWith({ key: 'value' });
      expect(mockLogger).toHaveBeenCalledWith('Formatted log');
    });

    it('should use default logger with formatted table if no custom formatter provided', () => {
      const logger = utils.createDebugLogger(mockLogger);
      logger({ key: 'value' });

      expect(spyPrintTable).toHaveBeenCalledTimes(1);
      expect(spyPrintTable).toHaveBeenNthCalledWith(1, { key: 'value' });
      expect(mockLogger).toHaveBeenCalledWith(
        `Executing Presto command\n${jest.mocked(spyPrintTable).mock.results[0].value}`
      );
    });
  });

  describe('noop', () => {
    it('should do nothing with noop', () => {
      expect(typeof utils.noop).toBe('function');
      expect(utils.noop()).toBeFalsy();
      expect(utils.noop('it')).toBeFalsy();
    });
  });

  describe('isUndefinedOrNull', () => {
    it('should return true for undefined', () => {
      expect(utils.isUndefinedOrNull(undefined)).toBe(true);
    });

    it('should return true for null', () => {
      expect(utils.isUndefinedOrNull(null)).toBe(true);
    });

    it('should return false for false', () => {
      expect(utils.isUndefinedOrNull(false)).toBe(false);
    });

    it('should return false for 0', () => {
      expect(utils.isUndefinedOrNull(0)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(utils.isUndefinedOrNull('')).toBe(false);
    });

    it('should return false for non-empty string', () => {
      expect(utils.isUndefinedOrNull('hello')).toBe(false);
    });

    it('should return false for object', () => {
      expect(utils.isUndefinedOrNull({})).toBe(false);
    });

    it('should return false for array', () => {
      expect(utils.isUndefinedOrNull([])).toBe(false);
    });

    it('should return false for function', () => {
      expect(utils.isUndefinedOrNull(() => {})).toBe(false);
    });

    it('should return false for NaN', () => {
      expect(utils.isUndefinedOrNull(NaN)).toBe(false);
    });
  });

  describe('removeEmptyValue', () => {
    it('should return undefined when input is undefined', () => {
      expect(utils.removeEmptyValue(undefined)).toBeUndefined();
    });

    it('should return undefined when input is an empty object', () => {
      expect(utils.removeEmptyValue({})).toBeUndefined();
    });

    it('should remove keys with undefined values', () => {
      expect(utils.removeEmptyValue({ a: 'value', b: undefined })).toEqual({ a: 'value' });
    });

    it('should remove keys with null values', () => {
      // @ts-ignore
      expect(utils.removeEmptyValue({ a: 'value', b: null })).toEqual({ a: 'value' });
    });

    it('should return the same object when no empty values exist', () => {
      expect(utils.removeEmptyValue({ a: 'hello', b: 'world' })).toEqual({ a: 'hello', b: 'world' });
    });

    it('should remove multiple empty values', () => {
      // @ts-ignore
      expect(utils.removeEmptyValue({ a: 'text', b: undefined, c: null, d: 'data' })).toEqual({
        a: 'text',
        d: 'data'
      });
    });

    it('should return undefined if all values are empty', () => {
      // @ts-ignore
      expect(utils.removeEmptyValue({ a: undefined, b: null })).toBeUndefined();
    });

    it('should not modify the original object', () => {
      const input = { a: 'text', b: undefined };
      const copy = { ...input };
      utils.removeEmptyValue(input);
      expect(input).toEqual(copy);
    });
  });

  describe('createProxy', () => {
    it('should return original properties correctly', () => {
      const obj = { a: 1, b: 'it' };
      const proxy = utils.createProxy(obj);

      expect(proxy.a).toBe(1);
      expect(proxy.b).toBe('it');
    });

    it('should call original synchronous method correctly', () => {
      const obj = {
        syncMethod: () => 'sync result'
      };
      const proxy = utils.createProxy(obj);

      expect(proxy.syncMethod()).toBe('sync result');
    });

    it('should call original async method correctly', async () => {
      const obj = {
        async asyncMethod() {
          return 'async result';
        }
      };
      const proxy = utils.createProxy(obj, new Set(['asyncMethod']));

      await expect(proxy.asyncMethod()).resolves.toBe('async result');
    });

    it('should throw DuckDBError for synchronous method errors', () => {
      const obj = {
        syncMethod: () => {
          throw new Error('Original sync error');
        }
      };
      const proxy = utils.createProxy(obj);

      expect(() => proxy.syncMethod()).toThrow(DuckDBError);
    });

    it('should throw DuckDBError for asynchronous method errors', async () => {
      const obj = {
        async asyncMethod() {
          throw new Error('Original async error');
        }
      };
      const proxy = utils.createProxy(obj, new Set(['asyncMethod']));

      await expect(proxy.asyncMethod()).rejects.toThrow(DuckDBError);
    });

    it('should call getter correctly', () => {
      const obj = {
        _value: 'test',
        get value() {
          return this._value;
        }
      };
      const proxy = utils.createProxy(obj);

      expect((proxy as any).value).toBe('test');
    });

    it('should throw DuckDBError for getters', () => {
      const obj = {
        get value() {
          throw new Error('error');
        }
      };
      const proxy = utils.createProxy(obj);

      expect(() => (proxy as any).value).toThrow(DuckDBError);
    });

    it('should return undefined when accessing a missing property', () => {
      const obj = { a: 1 };
      const proxy = utils.createProxy(obj);

      expect((proxy as any).missingProperty).toBeUndefined();
    });
  });
});
