import 'reflect-metadata';
import EventEmitter from 'node:events';
import dayjs from 'dayjs';
import type { Column } from 'presto-client';
import * as utils from './utils';

jest.mock('dayjs', () => {
  const actual = jest.requireActual('dayjs');
  return {
    __esModule: true,
    default: jest.fn(actual)
  };
});

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

  describe('getCurrentDateStr', () => {
    it('should format date correctly with milliseconds', () => {
      const formatted = utils.getCurrentDateStr();
      expect(dayjs).toHaveBeenCalledTimes(1);
      expect(formatted).toBeTruthy();
      expect(typeof formatted).toBe('string');
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

  describe('buildDataRows', () => {
    it('should map data to rows based on column names', () => {
      const columns: Record<string, any>[] = [{ name: 'column1' }, { name: 'column2' }, { name: 'column3' }];

      const data = [
        [1, 'foo', true],
        [2, 'bar', false],
        [3, 'baz', true]
      ];

      const result = utils.buildDataRows<{ column1: number; column2: string; column3: boolean }>(
        columns as Column[],
        data
      );

      expect(result).toEqual([
        { column1: 1, column2: 'foo', column3: true },
        { column1: 2, column2: 'bar', column3: false },
        { column1: 3, column2: 'baz', column3: true }
      ]);
    });

    it('should handle empty data correctly', () => {
      const columns: Record<string, any>[] = [{ name: 'column1' }, { name: 'column2' }];

      const data: unknown[][] = [];

      const result = utils.buildDataRows<{ column1: number; column2: string }>(columns as Column[], data);

      expect(result).toEqual([]);
    });

    it('should handle missing values in data', () => {
      const columns: Record<string, any>[] = [{ name: 'column1' }, { name: 'column2' }];

      const data = [[1], [2, 'bar']];

      const result = utils.buildDataRows<{ column1: number; column2: string | undefined }>(columns as Column[], data);

      expect(result).toEqual([
        { column1: 1, column2: undefined },
        { column1: 2, column2: 'bar' }
      ]);
    });
  });

  describe('noop', () => {
    it('should do nothing with noop', () => {
      expect(typeof utils.noop).toBe('function');
      expect(utils.noop()).toBeFalsy();
      expect(utils.noop('test')).toBeFalsy();
    });
  });

  describe('withResolvers', () => {
    it('should create a promise with resolve and reject methods', async () => {
      const { promise, resolve, reject } = utils.withResolvers<string>();

      expect(promise).toBeInstanceOf(Promise);
      expect(typeof resolve).toBe('function');
      expect(typeof reject).toBe('function');
    });

    it('should resolve the promise when resolve is called', async () => {
      const { promise, resolve } = utils.withResolvers<string>();
      const resolvedValue = 'Hello World';

      resolve(resolvedValue);

      await expect(promise).resolves.toBe(resolvedValue);
    });

    it('should reject the promise when reject is called', async () => {
      const { promise, reject } = utils.withResolvers<string>();
      const error = new Error('Something went wrong');

      reject(error);

      await expect(promise).rejects.toThrow('Something went wrong');
    });

    it('should resolve only once', async () => {
      const { promise, resolve } = utils.withResolvers<number>();
      resolve(42);
      resolve(99); // This should be ignored
      const result = await promise;

      expect(result).toBe(42);
    });

    it('should reject only once', async () => {
      const { promise, reject } = utils.withResolvers<number>();
      const error = new Error('Initial Error');
      reject(error);
      reject(new Error('Second Error')); // This should be ignored

      await expect(promise).rejects.toThrow('Initial Error');
    });

    it('should support chaining after resolve', async () => {
      const { promise, resolve } = utils.withResolvers<number>();
      resolve(10);

      const result = await promise.then((value) => value * 2);
      expect(result).toBe(20);
    });

    it('should support catch after reject', async () => {
      const { promise, reject } = utils.withResolvers<number>();
      const error = new Error('Test Error');
      reject(error);

      const result = await promise.catch((err) => {
        expect(err).toBe(error);
        return 0;
      });

      expect(result).toBe(0);
    });
  });
});
