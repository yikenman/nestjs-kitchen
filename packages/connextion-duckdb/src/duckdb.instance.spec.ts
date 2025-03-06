import { DuckDBInstance as DuckDBInstanceClass } from '@duckdb/node-api';
import { Logger } from '@nestjs/common';
import { DuckDBResultAsyncMethods, DuckDBResultReaderAsyncMethods } from './constants';
import { DuckDBInstance } from './duckdb.instance';
import { DuckDBError } from './errors';
import { createDebugLogger, createProxy } from './utils';

jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');
  return {
    ...actual,
    Logger: jest.fn()
  };
});
jest.mock('./utils', () => {
  const actual = jest.requireActual('./utils');
  return {
    ...actual,
    createDebugLogger: jest.fn(actual.createDebugLogger),
    createProxy: jest.fn(actual.createProxy)
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

describe('DuckDBInstance', () => {
  let mockLogger: jest.Mocked<Logger>;
  let mockDebugLogger: jest.Mocked<() => void>;
  let instance: DuckDBInstance;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      error: jest.fn()
    } as unknown as jest.Mocked<Logger>;
    mockDebugLogger = jest.fn();

    instance = new DuckDBInstance('testDB', { debug: false, path: ':memory:' });

    (instance as any).logger = mockLogger;
    (instance as any).debugLogger = mockDebugLogger;
  });

  it('should initialize correctly', () => {
    expect(instance).toBeInstanceOf(DuckDBInstance);
  });

  it('should create debug logger in debug mode', () => {
    jest.clearAllMocks();
    jest.resetModules();

    jest.mocked(Logger).mockReturnValue(mockLogger);

    const debugInstance = new DuckDBInstance('testDB', { debug: true, path: ':memory:' });
    expect(createDebugLogger).toHaveBeenCalledWith(expect.any(Function), true);
  });

  describe('create', () => {
    it('should create a new DuckDB instance', async () => {
      // @ts-ignore
      const mockCreate = jest.spyOn(DuckDBInstanceClass, 'create').mockResolvedValue({ connect: jest.fn() });

      await instance.create({ path: 'test_path', debug: true });

      expect(mockCreate).toHaveBeenCalledWith('test_path', undefined);
    });

    it('should log error if create fails', async () => {
      jest.spyOn(DuckDBInstanceClass, 'create').mockRejectedValue(new Error('Create failed'));

      await instance.create({ path: 'test_path', debug: true });

      expect(mockLogger.error).toHaveBeenCalledWith('Create failed');
    });
  });

  describe('dispose', () => {
    it('should be defined', () => {
      expect(instance.dispose()).toBeUndefined();
    });
  });

  describe('inner', () => {
    it('should throw error if instance is not found', async () => {
      await expect(instance['inner']('run', 'SELECT * FROM users')).rejects.toThrow(DuckDBError);
    });

    it('should call inner and return result for run method', async () => {
      const value = { value: 'mock_result' };
      const mockConnect = jest.fn().mockResolvedValue({
        run: jest.fn().mockResolvedValue(value)
      });

      instance['instance'] = { connect: mockConnect } as any;

      const result = await instance.run('SELECT * FROM users');
      expect(mockDebugLogger).toHaveBeenCalled();
      expect(createProxy).toHaveBeenCalledWith(value, DuckDBResultAsyncMethods);
      expect(result).toBe(jest.mocked(createProxy).mock.results[0].value);
    });

    it('should call inner and return result for runAndRead method', async () => {
      const value = { value: 'mock_result' };
      const mockConnect = jest.fn().mockResolvedValue({
        runAndRead: jest.fn().mockResolvedValue(value)
      });

      instance['instance'] = { connect: mockConnect } as any;

      const result = await instance.runAndRead('SELECT * FROM users');
      expect(mockDebugLogger).toHaveBeenCalled();
      expect(createProxy).toHaveBeenCalledWith(value, DuckDBResultReaderAsyncMethods);
      expect(result).toBe(jest.mocked(createProxy).mock.results[0].value);
    });

    it('should call inner and return result for stream method', async () => {
      const value = { value: 'mock_result' };
      const mockConnect = jest.fn().mockResolvedValue({
        stream: jest.fn().mockResolvedValue(value)
      });

      instance['instance'] = { connect: mockConnect } as any;

      const result = await instance.stream('SELECT * FROM users');
      expect(mockDebugLogger).toHaveBeenCalled();
      expect(createProxy).toHaveBeenCalledWith(value, DuckDBResultAsyncMethods);
      expect(result).toBe(jest.mocked(createProxy).mock.results[0].value);
    });

    it('should call inner and return result for streamAndRead method', async () => {
      const value = { value: 'mock_result' };
      const mockConnect = jest.fn().mockResolvedValue({
        streamAndRead: jest.fn().mockResolvedValue(value)
      });

      instance['instance'] = { connect: mockConnect } as any;

      const result = await instance.streamAndRead('SELECT * FROM users');
      expect(mockDebugLogger).toHaveBeenCalled();
      expect(createProxy).toHaveBeenCalledWith(value, DuckDBResultReaderAsyncMethods);
      expect(result).toBe(jest.mocked(createProxy).mock.results[0].value);
    });

    it('should throw DuckDBError if inner method fails', async () => {
      instance['instance'] = { connect: jest.fn().mockRejectedValue(new Error('Inner method failed')) } as any;

      await expect(instance.run('SELECT * FROM users')).rejects.toThrow(DuckDBError);
    });
  });

  describe('createAppender', () => {
    it('should correctly create an appender', async () => {
      const value = { value: 'mock_appender' };
      const mockConnect = jest.fn().mockResolvedValue({
        createAppender: jest.fn().mockResolvedValue(value)
      });

      instance['instance'] = { connect: mockConnect } as any;

      const result = await instance.createAppender('test_table');
      expect(mockDebugLogger).toHaveBeenCalled();
      expect(createProxy).toHaveBeenCalledWith(value);
      expect(result).toBe(jest.mocked(createProxy).mock.results[0].value);
    });

    it('should throw error if instance is not found', async () => {
      await expect(instance.createAppender('test_table')).rejects.toThrow(DuckDBError);
    });

    it('should throw DuckDBError if createAppender fails', async () => {
      instance['instance'] = { connect: jest.fn().mockRejectedValue(new Error('Appender error')) } as any;

      await expect(instance.createAppender('test_table')).rejects.toThrow(DuckDBError);
    });
  });
});
