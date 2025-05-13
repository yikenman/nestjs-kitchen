import 'reflect-metadata';
import EventEmitter from 'node:events';
import dayjs from 'dayjs';
import { type PoolClient } from 'pg';
import { TRANSACTION_META } from './constants';
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
  describe('isSubmittable', () => {
    it('should return true for objects with a submit method', () => {
      const submittable = { submit: jest.fn() };
      expect(utils.isSubmittable(submittable)).toBe(true);
    });

    it('should return false for objects without a submit method', () => {
      expect(utils.isSubmittable({})).toBe(false);
    });
  });

  describe('isObject', () => {
    it('should return true for plain objects', () => {
      expect(utils.isObject({})).toBe(true);
    });

    it('should return false for non-objects', () => {
      expect(utils.isObject(null)).toBe(false);
      expect(utils.isObject([])).toBe(false);
    });
  });

  describe('normalizeStrings', () => {
    it('should normalize and remove duplicates', () => {
      const input = ['  abc  ', 'abc', 'def', '', null] as string[];
      const expected = ['abc', 'def'];
      expect(utils.normalizeStrings(input)).toEqual(expected);
    });

    it('should handle empty value', () => {
      expect(utils.normalizeStrings(undefined)).toEqual([]);
    });
  });

  describe('plainPromise', () => {
    it('should return resolved value as the first tuple item', async () => {
      const [result, error] = await utils.plainPromise(Promise.resolve('success'));
      expect(result).toBe('success');
      expect(error).toBeUndefined();
    });

    it('should return error as the second tuple item', async () => {
      const [result, error] = await utils.plainPromise(Promise.reject(new Error('fail')));
      expect(result).toBeUndefined();
      expect(error).toBeInstanceOf(Error);
    });
  });

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

  describe('formatArray', () => {
    it('should format a non-empty array correctly', () => {
      const arr = [1, 'test', true, null];
      const formatted = utils.formatArray(arr);
      expect(formatted).toBe('[1, test, true, null]');
    });

    it('should handle an empty array', () => {
      const arr: any[] = [];
      const formatted = utils.formatArray(arr);
      expect(formatted).toBe('[]');
    });

    it('should return "null" if input is not an array', () => {
      const formatted = utils.formatArray(null);
      expect(formatted).toBe('null');
    });

    it('should handle undefined input', () => {
      const formatted = utils.formatArray(undefined as any);
      expect(formatted).toBe('null');
    });
  });

  describe('extraceQueryTextAndValues', () => {
    const spyIsSubmittable = jest.spyOn(utils, 'isSubmittable');
    const spyIsObject = jest.spyOn(utils, 'isObject');

    it('should handle Submittable', () => {
      const input = { text: 'SELECT * FROM table', values: [1, 2, 3], submit: () => {} };
      const result = utils.extraceQueryTextAndValues(input);

      expect(result).toEqual([input.text, input.values]);
      expect(spyIsSubmittable).toHaveBeenCalledWith(input);
      expect(spyIsObject).not.toHaveBeenCalled();
    });
    it('should handle QueryConfig', () => {
      const input = { text: 'SELECT * FROM table', values: [1, 2, 3] };
      const result = utils.extraceQueryTextAndValues(input);

      expect(result).toEqual([input.text, input.values]);
      expect(spyIsSubmittable).toHaveBeenCalledWith(input);
      expect(spyIsObject).toHaveBeenCalledWith(input);
    });
    it('should handle QueryConfig with values', () => {
      const input = { text: 'SELECT * FROM table' };
      const values = [1, 2, 3];
      const result = utils.extraceQueryTextAndValues(input, values);

      expect(result).toEqual([input.text, values]);
      expect(spyIsSubmittable).toHaveBeenCalledWith(input);
      expect(spyIsObject).toHaveBeenCalledWith(input);
    });
    it('should handle query text', () => {
      const text = 'SELECT * FROM table';
      const result = utils.extraceQueryTextAndValues(text);

      expect(result).toEqual([text, undefined]);
      expect(spyIsSubmittable).toHaveBeenCalledWith(text);
      expect(spyIsObject).toHaveBeenCalledWith(text);
    });
    it('should handle query text with values', () => {
      const text = 'SELECT * FROM table';
      const values = [1, 2, 3];
      const result = utils.extraceQueryTextAndValues(text, values);

      expect(result).toEqual([text, values]);
      expect(spyIsSubmittable).toHaveBeenCalledWith(text);
      expect(spyIsObject).toHaveBeenCalledWith(text);
    });

    it('should handle falsy value', () => {
      const result = utils.extraceQueryTextAndValues(undefined);

      expect(result).toEqual([undefined, undefined]);
      expect(spyIsSubmittable).not.toHaveBeenCalled();
      expect(spyIsObject).not.toHaveBeenCalled();
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
        `Executing Postgres command\n${jest.mocked(spyPrintTable).mock.results[0].value}`
      );
    });
  });

  describe('debugFactroy', () => {
    const mockLogger = jest.fn();
    const spyGetCurrentDateStr = jest.spyOn(utils, 'getCurrentDateStr');

    let debug: ReturnType<typeof utils.debugFactroy>;

    beforeEach(() => {
      debug = utils.debugFactroy('test-instance', 'test-query-id', 'test-host', mockLogger);
    });

    it('should return debug functions', () => {
      expect(debug.pool.connect).toBeDefined();
      expect(typeof debug.pool.connect).toBe('function');
      expect(debug.client.query).toBeDefined();
      expect(typeof debug.client.query).toBe('function');
      expect(debug.client.release).toBeDefined();
      expect(typeof debug.client.release).toBe('function');
    });

    describe('debug pool.connect', () => {
      it('should log when a new client is requested and successfully returned', async () => {
        const callback = jest.fn(async () => ({ id: 'client-id' }) as unknown as PoolClient);
        const debug = utils.debugFactroy('test-instance', 'test-query-id', 'test-host', mockLogger);

        const client = await debug.pool.connect(callback)();
        expect(client).toBeDefined();

        expect(spyGetCurrentDateStr).toHaveBeenCalledTimes(2);
        expect(mockLogger).toHaveBeenCalledWith(
          expect.objectContaining({
            Instance: 'test-instance',
            Host: 'test-host',
            Client: 'test-query-id',
            Type: 'Request new client',
            Status: 'Successful',
            'Started On': jest.mocked(spyGetCurrentDateStr).mock.results[0].value,
            'Ended On': jest.mocked(spyGetCurrentDateStr).mock.results[1].value
          })
        );
      });

      it('should log when requesting a client fails', async () => {
        const error = new Error('Client error');
        const callback = jest.fn(async () => {
          throw error;
        });
        const debug = utils.debugFactroy('test-instance', 'test-query-id', 'test-host', mockLogger);

        await expect(debug.pool.connect(callback)()).rejects.toThrow(error);

        expect(spyGetCurrentDateStr).toHaveBeenCalledTimes(2);
        expect(mockLogger).toHaveBeenCalledWith(
          expect.objectContaining({
            Instance: 'test-instance',
            Host: 'test-host',
            Client: 'test-query-id',
            Type: 'Request new client',
            Status: 'Failed',
            'Started On': jest.mocked(spyGetCurrentDateStr).mock.results[0].value,
            'Ended On': jest.mocked(spyGetCurrentDateStr).mock.results[1].value,
            Error: error
          })
        );
      });

      it('should print error code if have', async () => {
        const error = new Error('Client error');
        //@ts-ignore
        error.code = 'error-code';
        const callback = jest.fn(async () => {
          throw error;
        });
        const debug = utils.debugFactroy('test-instance', 'test-query-id', 'test-host', mockLogger);

        await expect(debug.pool.connect(callback)()).rejects.toThrow(error);

        expect(spyGetCurrentDateStr).toHaveBeenCalledTimes(2);
        expect(mockLogger).toHaveBeenCalledWith(
          expect.objectContaining({
            Instance: 'test-instance',
            Host: 'test-host',
            Client: 'test-query-id',
            Type: 'Request new client',
            Status: 'Failed',
            'Started On': jest.mocked(spyGetCurrentDateStr).mock.results[0].value,
            'Ended On': jest.mocked(spyGetCurrentDateStr).mock.results[1].value,
            //@ts-ignore
            Error: `[${error.code}]${error}`
          })
        );
      });
    });

    describe('debug client.query', () => {
      const spyExtraceQueryTextAndValues = jest.spyOn(utils, 'extraceQueryTextAndValues');
      const spyIsSubmittable = jest.spyOn(utils, 'isSubmittable');
      const spyFormatArray = jest.spyOn(utils, 'formatArray');
      const input = ['SELECT * FROM table', [1, 2, 3]];

      it('should log a successful query', async () => {
        const callback = jest.fn(async (..._rest: any[]) => 'query result');

        const result = await debug.client.query(callback)(...input);
        expect(result).toBe('query result');

        expect(spyExtraceQueryTextAndValues).toHaveBeenCalledTimes(1);
        expect(spyExtraceQueryTextAndValues).toHaveBeenCalledWith(...input);

        expect(spyIsSubmittable).toHaveBeenCalledTimes(2);
        expect(spyIsSubmittable).toHaveBeenNthCalledWith(2, input[0]);

        expect(spyGetCurrentDateStr).toHaveBeenCalledTimes(2);

        expect(spyFormatArray).toHaveBeenCalledTimes(1);
        expect(spyFormatArray).toHaveBeenCalledWith(jest.mocked(spyExtraceQueryTextAndValues).mock.results[0].value[1]);

        expect(mockLogger).toHaveBeenCalledWith(
          expect.objectContaining({
            Instance: 'test-instance',
            Host: 'test-host',
            Client: 'test-query-id',
            Type: 'Query',
            Text: jest.mocked(spyExtraceQueryTextAndValues).mock.results[0].value[0],
            Values: jest.mocked(spyFormatArray).mock.results[0].value,
            Status: 'Successful',
            'Started On': jest.mocked(spyGetCurrentDateStr).mock.results[0].value,
            'Ended On': jest.mocked(spyGetCurrentDateStr).mock.results[1].value
          })
        );
      });

      it('should log a failed query', async () => {
        const error = new Error('Query error');
        const callback = jest.fn(async (..._rest: any[]) => {
          throw error;
        });

        await expect(debug.client.query(callback)(...input)).rejects.toThrow(error);

        expect(spyExtraceQueryTextAndValues).toHaveBeenCalledTimes(1);
        expect(spyExtraceQueryTextAndValues).toHaveBeenCalledWith(...input);

        expect(spyIsSubmittable).toHaveBeenCalledTimes(2);
        expect(spyIsSubmittable).toHaveBeenNthCalledWith(2, input[0]);

        expect(spyGetCurrentDateStr).toHaveBeenCalledTimes(2);

        expect(spyFormatArray).toHaveBeenCalledTimes(1);
        expect(spyFormatArray).toHaveBeenCalledWith(jest.mocked(spyExtraceQueryTextAndValues).mock.results[0].value[1]);

        expect(mockLogger).toHaveBeenCalledWith(
          expect.objectContaining({
            Instance: 'test-instance',
            Host: 'test-host',
            Client: 'test-query-id',
            Type: 'Query',
            Text: jest.mocked(spyExtraceQueryTextAndValues).mock.results[0].value[0],
            Values: jest.mocked(spyFormatArray).mock.results[0].value,
            Status: 'Failed',
            'Started On': jest.mocked(spyGetCurrentDateStr).mock.results[0].value,
            'Ended On': jest.mocked(spyGetCurrentDateStr).mock.results[1].value,
            Error: error
          })
        );
      });

      it('should log a failed query', async () => {
        const error = new Error('Query error');
        //@ts-ignore
        error.code = 'error-code';
        const callback = jest.fn(async (..._rest: any[]) => {
          throw error;
        });

        await expect(debug.client.query(callback)(...input)).rejects.toThrow(error);

        expect(spyExtraceQueryTextAndValues).toHaveBeenCalledTimes(1);
        expect(spyExtraceQueryTextAndValues).toHaveBeenCalledWith(...input);

        expect(spyIsSubmittable).toHaveBeenCalledTimes(2);
        expect(spyIsSubmittable).toHaveBeenNthCalledWith(2, input[0]);

        expect(spyGetCurrentDateStr).toHaveBeenCalledTimes(2);

        expect(spyFormatArray).toHaveBeenCalledTimes(1);
        expect(spyFormatArray).toHaveBeenCalledWith(jest.mocked(spyExtraceQueryTextAndValues).mock.results[0].value[1]);

        expect(mockLogger).toHaveBeenCalledWith(
          expect.objectContaining({
            Instance: 'test-instance',
            Host: 'test-host',
            Client: 'test-query-id',
            Type: 'Query',
            Text: jest.mocked(spyExtraceQueryTextAndValues).mock.results[0].value[0],
            Values: jest.mocked(spyFormatArray).mock.results[0].value,
            Status: 'Failed',
            'Started On': jest.mocked(spyGetCurrentDateStr).mock.results[0].value,
            'Ended On': jest.mocked(spyGetCurrentDateStr).mock.results[1].value,
            //@ts-ignore
            Error: `[${error.code}]${error}`
          })
        );
      });

      it('should log submittable', () => {
        const mockEmitter = new EventEmitter();
        // @ts-ignore
        mockEmitter.submit = () => {};
        // @ts-ignore
        mockEmitter.text = input[0];
        // @ts-ignore
        mockEmitter.values = input[1];

        const callback = jest.fn(async (..._rest: any[]) => 'submittable result');
        const debug = utils.debugFactroy('test-instance', 'test-query-id', 'test-host', mockLogger);

        const query = debug.client.query(callback)(mockEmitter);

        expect(spyExtraceQueryTextAndValues).toHaveBeenCalledTimes(1);
        expect(spyExtraceQueryTextAndValues).toHaveBeenCalledWith(mockEmitter);

        expect(spyIsSubmittable).toHaveBeenCalledTimes(2);
        expect(spyIsSubmittable).toHaveBeenNthCalledWith(2, mockEmitter);

        mockEmitter.emit('end');

        expect(spyFormatArray).toHaveBeenCalledTimes(1);
        expect(spyFormatArray).toHaveBeenCalledWith(jest.mocked(spyExtraceQueryTextAndValues).mock.results[0].value[1]);

        expect(spyGetCurrentDateStr).toHaveBeenCalledTimes(2);

        expect(mockLogger).toHaveBeenCalledWith(
          expect.objectContaining({
            Instance: 'test-instance',
            Host: 'test-host',
            Client: 'test-query-id',
            Type: 'Submittable',
            Text: jest.mocked(spyExtraceQueryTextAndValues).mock.results[0].value[0],
            Values: jest.mocked(spyFormatArray).mock.results[0].value,
            Status: 'Successful',
            'Started On': jest.mocked(spyGetCurrentDateStr).mock.results[0].value,
            'Ended On': jest.mocked(spyGetCurrentDateStr).mock.results[1].value
          })
        );
      });

      it('should log submittable with error', () => {
        const mockEmitter = new EventEmitter();
        // @ts-ignore
        mockEmitter.submit = () => {};
        // @ts-ignore
        mockEmitter.text = input[0];
        // @ts-ignore
        mockEmitter.values = input[1];

        const callback = jest.fn(async (..._rest: any[]) => 'submittable result');
        const debug = utils.debugFactroy('test-instance', 'test-query-id', 'test-host', mockLogger);

        const query = debug.client.query(callback)(mockEmitter);

        expect(spyExtraceQueryTextAndValues).toHaveBeenCalledTimes(1);
        expect(spyExtraceQueryTextAndValues).toHaveBeenCalledWith(mockEmitter);

        expect(spyIsSubmittable).toHaveBeenCalledTimes(2);
        expect(spyIsSubmittable).toHaveBeenNthCalledWith(2, mockEmitter);

        const error = new Error('Submittable error');
        mockEmitter.emit('error', error);

        expect(spyFormatArray).toHaveBeenCalledTimes(1);
        expect(spyFormatArray).toHaveBeenCalledWith(jest.mocked(spyExtraceQueryTextAndValues).mock.results[0].value[1]);

        expect(spyGetCurrentDateStr).toHaveBeenCalledTimes(2);

        expect(mockLogger).toHaveBeenCalledWith(
          expect.objectContaining({
            Instance: 'test-instance',
            Host: 'test-host',
            Client: 'test-query-id',
            Type: 'Submittable',
            Text: jest.mocked(spyExtraceQueryTextAndValues).mock.results[0].value[0],
            Values: jest.mocked(spyFormatArray).mock.results[0].value,
            Status: 'Failed',
            'Started On': jest.mocked(spyGetCurrentDateStr).mock.results[0].value,
            'Ended On': jest.mocked(spyGetCurrentDateStr).mock.results[1].value,
            Error: error
          })
        );
      });

      it('should print submittable with error code if have', () => {
        const mockEmitter = new EventEmitter();
        // @ts-ignore
        mockEmitter.submit = () => {};
        // @ts-ignore
        mockEmitter.text = input[0];
        // @ts-ignore
        mockEmitter.values = input[1];

        const callback = jest.fn(async (..._rest: any[]) => 'submittable result');
        const debug = utils.debugFactroy('test-instance', 'test-query-id', 'test-host', mockLogger);

        const query = debug.client.query(callback)(mockEmitter);

        expect(spyExtraceQueryTextAndValues).toHaveBeenCalledTimes(1);
        expect(spyExtraceQueryTextAndValues).toHaveBeenCalledWith(mockEmitter);

        expect(spyIsSubmittable).toHaveBeenCalledTimes(2);
        expect(spyIsSubmittable).toHaveBeenNthCalledWith(2, mockEmitter);

        const error = new Error('Submittable error');
        //@ts-ignore
        error.code = 'error-code';
        mockEmitter.emit('error', error);

        expect(spyFormatArray).toHaveBeenCalledTimes(1);
        expect(spyFormatArray).toHaveBeenCalledWith(jest.mocked(spyExtraceQueryTextAndValues).mock.results[0].value[1]);

        expect(spyGetCurrentDateStr).toHaveBeenCalledTimes(2);

        expect(mockLogger).toHaveBeenCalledWith(
          expect.objectContaining({
            Instance: 'test-instance',
            Host: 'test-host',
            Client: 'test-query-id',
            Type: 'Submittable',
            Text: jest.mocked(spyExtraceQueryTextAndValues).mock.results[0].value[0],
            Values: jest.mocked(spyFormatArray).mock.results[0].value,
            Status: 'Failed',
            'Started On': jest.mocked(spyGetCurrentDateStr).mock.results[0].value,
            'Ended On': jest.mocked(spyGetCurrentDateStr).mock.results[1].value,
            //@ts-ignore
            Error: `[${error.code}]${error}`
          })
        );
      });
    });

    describe('debug client.release', () => {
      it('should log when a client is released', () => {
        const callback = jest.fn(() => {});
        const debug = utils.debugFactroy('test-instance', 'test-query-id', 'test-host', mockLogger);

        debug.client.release(callback)();

        expect(spyGetCurrentDateStr).toHaveBeenCalledTimes(2);
        expect(mockLogger).toHaveBeenCalledWith(
          expect.objectContaining({
            Instance: 'test-instance',
            Host: 'test-host',
            Client: 'test-query-id',
            Type: 'Release client',
            Status: 'Successful',
            'Started On': jest.mocked(spyGetCurrentDateStr).mock.results[0].value,
            'Ended On': jest.mocked(spyGetCurrentDateStr).mock.results[1].value
          })
        );
      });

      it('should log when releasing a client fails', () => {
        const error = new Error('Release error');
        const callback = jest.fn(() => {
          throw error;
        });
        const debug = utils.debugFactroy('test-instance', 'test-query-id', 'test-host', mockLogger);

        expect(() => debug.client.release(callback)()).toThrow(error);

        expect(spyGetCurrentDateStr).toHaveBeenCalledTimes(2);
        expect(mockLogger).toHaveBeenCalledWith(
          expect.objectContaining({
            Instance: 'test-instance',
            Host: 'test-host',
            Client: 'test-query-id',
            Type: 'Release client',
            Status: 'Failed',
            'Started On': jest.mocked(spyGetCurrentDateStr).mock.results[0].value,
            'Ended On': jest.mocked(spyGetCurrentDateStr).mock.results[1].value,
            Error: error
          })
        );
      });

      it('should print error code if have', () => {
        const error = new Error('Release error');
        //@ts-ignore
        error.code = 'error-code';
        const callback = jest.fn(() => {
          throw error;
        });
        const debug = utils.debugFactroy('test-instance', 'test-query-id', 'test-host', mockLogger);

        expect(() => debug.client.release(callback)()).toThrow(error);

        expect(spyGetCurrentDateStr).toHaveBeenCalledTimes(2);
        expect(mockLogger).toHaveBeenCalledWith(
          expect.objectContaining({
            Instance: 'test-instance',
            Host: 'test-host',
            Client: 'test-query-id',
            Type: 'Release client',
            Status: 'Failed',
            'Started On': jest.mocked(spyGetCurrentDateStr).mock.results[0].value,
            'Ended On': jest.mocked(spyGetCurrentDateStr).mock.results[1].value,
            //@ts-ignore
            Error: `[${error.code}]${error}`
          })
        );
      });
    });
  });

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

  describe('getTransactionMetdata', () => {
    let mockTarget: {};

    beforeEach(() => {
      mockTarget = {};
    });

    it('should get transaction metadata if it exists', () => {
      Reflect.defineMetadata(TRANSACTION_META, true, mockTarget);

      const metadata = utils.getTransactionMetdata(mockTarget);
      expect(metadata).toBe(true);
    });

    it('should return undefined if transaction metadata does not exist', () => {
      const metadata = utils.getTransactionMetdata(mockTarget);
      expect(metadata).toBeUndefined();
    });
  });
  describe('setTransactionMetdata', () => {
    let mockTarget: {};

    beforeEach(() => {
      mockTarget = {};
    });

    it('should set transaction metadata', () => {
      utils.setTransactionMetdata(mockTarget);

      const metadata = Reflect.getMetadata(TRANSACTION_META, mockTarget);
      expect(metadata).toBe(true);
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

  describe('normalizeOptions', () => {
    it('should normalize when hosts is provided', () => {
      const options = {
        hosts: [
          { host: 'host1', port: 1234 },
          { host: 'host2', port: 5678 }
        ],
        username: 'user'
      };

      const result = utils.normalizeOptions(options);

      expect(result).toEqual([
        { host: 'host1', port: 1234, username: 'user' },
        { host: 'host2', port: 5678, username: 'user' }
      ]);
    });

    it('should normalize when only host and port are provided (no hosts)', () => {
      const options = {
        host: 'single-host',
        port: 9999,
        username: 'admin'
      };

      const result = utils.normalizeOptions(options);

      expect(result).toEqual([{ host: 'single-host', port: 9999, username: 'admin' }]);
    });
  });

  describe('isFailoverRequired', () => {
    it('should return true for known failover error codes', () => {
      const errorCodes = [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'EHOSTUNREACH',
        'ENOTFOUND',
        'EAI_AGAIN',
        'ECONNRESET',
        'EPIPE',
        '57P01',
        '57P02',
        '57P03',
        '55P03',
        '55000',
        '54000',
        '53300',
        '08006',
        'XX000'
      ];

      for (const code of errorCodes) {
        expect(utils.isFailoverRequired({ code })).toBe(true);
      }
    });

    it('should return false for unknown error codes', () => {
      expect(utils.isFailoverRequired({ code: 'UNKNOWN' })).toBe(false);
      expect(utils.isFailoverRequired({ code: '12345' })).toBe(false);
    });

    it('should return false when code is undefined', () => {
      expect(utils.isFailoverRequired({})).toBe(false);
      expect(utils.isFailoverRequired(undefined)).toBe(false);
    });
  });
});
