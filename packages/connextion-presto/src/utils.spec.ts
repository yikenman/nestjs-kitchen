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
});
