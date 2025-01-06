import { AsyncLocalStorage } from 'node:async_hooks';
import { EventEmitter } from 'node:stream';
import { ConnextionInstance } from '@nestjs-kitchen/connextion';
import { Logger } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { uid } from 'uid';
import { ALS, CONNEXTION_POSTGRES_DEBUG, GET_CLIENT } from './constants';
import { PostgresError } from './errors';
import { PostgresInstance } from './postgres.instance';
import { createDebugLogger, debugFactroy, isSubmittable } from './utils';

jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');
  return {
    ...actual,
    Logger: jest.fn()
  };
});

jest.mock('pg', () => {
  const actual = jest.requireActual('pg');
  return {
    ...actual,
    Pool: jest.fn(actual.Pool)
  };
});

jest.mock('./utils', () => {
  const actual = jest.requireActual('./utils');
  return {
    ...actual,
    createDebugLogger: jest.fn(actual.createDebugLogger),
    debugFactroy: jest.fn(actual.debugFactroy),
    isSubmittable: jest.fn(actual.isSubmittable)
  };
});

jest.mock('uid', () => {
  const actual = jest.requireActual('uid');
  return {
    ...actual,
    uid: jest.fn(actual.uid)
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

describe('PostgresInstance', () => {
  let instance: PostgresInstance;
  let mockPool: jest.Mocked<Pool>;
  let mockClient: jest.Mocked<PoolClient>;
  let mockLogger: jest.Mocked<Logger>;
  let mockListener1: jest.Mocked<any>;
  let mockListener2: jest.Mocked<any>;

  let spyDispose: jest.Spied<PostgresInstance['dispose']>;
  let spyEnd: jest.SpyInstance<PostgresInstance['end']>;

  beforeEach(() => {
    mockPool = {
      connect: jest.fn(),
      end: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as jest.Mocked<Pool>;

    mockClient = {
      on: jest.fn(),
      query: jest.fn(),
      release: jest.fn(),
      end: jest.fn()
    } as unknown as jest.Mocked<PoolClient>;

    mockLogger = {
      debug: jest.fn(),
      error: jest.fn()
    } as unknown as jest.Mocked<Logger>;

    mockListener1 = jest.fn();
    mockListener2 = jest.fn();

    jest.mocked(Pool).mockImplementation(() => mockPool);

    spyDispose = jest.spyOn(PostgresInstance.prototype, 'dispose');
    spyEnd = jest.spyOn(PostgresInstance.prototype as any, 'end');

    instance = new PostgresInstance('testInstance');
    (instance as any).logger = mockLogger;
    (instance as any).listener1 = mockListener1;
    (instance as any).listener2 = mockListener2;
  });

  it('should be instance of ConnextionInstance', () => {
    expect(instance instanceof ConnextionInstance).toBeTruthy();
  });

  it('should create a Logger', () => {
    expect(Logger).toHaveBeenCalledWith(`Postgres][testInstance`);
  });

  it('should create a AsyncLocalStorage', () => {
    expect((instance as any)[ALS]).toBeInstanceOf(AsyncLocalStorage);
  });

  describe('listener', () => {
    let instance: PostgresInstance;

    beforeEach(() => {
      instance = new PostgresInstance('testInstance');
      (instance as any).logger = mockLogger;
    });

    it('should create listeners', () => {
      expect((instance as any).listener1).toBeDefined();
      expect(typeof (instance as any).listener1).toBe('function');
      expect((instance as any).listener2).toBeDefined();
      expect(typeof (instance as any).listener2).toBe('function');
    });

    it('should register listener2 when trigger listener1', () => {
      (instance as any).listener1(mockClient);

      expect(mockClient.on).toHaveBeenCalledWith('error', (instance as any).listener2);
    });

    it('should call logger.error when trigger listener2', () => {
      const err = new Error('error');
      (instance as any).listener2(err);

      expect(mockLogger.error).toHaveBeenCalledWith(err);
    });
  });

  describe('create', () => {
    it('should call dispose() and create a new pool on create()', () => {
      expect((instance as any).pool).toBeUndefined();

      const options = { user: 'test', host: 'localhost', database: 'testdb', password: 'secret', port: 5432 };
      instance.create(options);

      expect(spyDispose).toHaveBeenCalled();
      expect(Pool).toHaveBeenCalledWith(options);
      expect(mockPool.on).toHaveBeenCalledWith('connect', mockListener1);
      expect(mockPool.on).toHaveBeenCalledWith('error', mockListener2);
      expect((instance as any).pool).toBe(mockPool);
    });
  });

  describe('dispose', () => {
    it('should dispose the existing pool', async () => {
      instance.create({ user: 'test', host: 'localhost', database: 'testdb', password: 'secret', port: 5432 });
      const pool = (instance as any).pool;
      expect(pool).toBe(mockPool);

      await instance.dispose();
      expect((instance as any).pool).toBeUndefined();
      expect(spyEnd).toHaveBeenCalledWith(pool);

      expect(pool.end).toHaveBeenCalled();
      expect(pool.off).toHaveBeenCalledWith('connect', mockListener1);
      expect(pool.off).toHaveBeenCalledWith('error', mockListener2);
    });

    it('should skip dispose if pool is undefined', async () => {
      const pool = (instance as any).pool;
      expect(pool).toBeUndefined();

      await instance.dispose();

      expect(spyEnd).not.toHaveBeenCalled();
    });
  });

  describe('end', () => {
    it('should end the pool if provided', async () => {
      await (instance as any).end(mockPool);

      expect(mockPool.end).toHaveBeenCalled();
      expect(mockPool.off).toHaveBeenCalledWith('connect', mockListener1);
      expect(mockPool.off).toHaveBeenCalledWith('error', mockListener2);
    });

    it('should log error if failedd to end the pool', async () => {
      const err = new Error('End error');
      //@ts-ignore
      mockPool.end.mockRejectedValueOnce(err);

      await (instance as any).end(mockPool);

      expect(mockLogger.error).toHaveBeenCalledWith(err);
    });

    it('should not end the pool if not provided', async () => {
      await (instance as any).end();

      expect(mockPool.end).not.toHaveBeenCalled();
      expect(mockPool.off).not.toHaveBeenCalled();
    });
  });

  describe('get client', () => {
    it('should throw an error if pool is not created', async () => {
      expect((instance as any).pool).toBeUndefined();
      await expect(instance[GET_CLIENT]()).rejects.toThrow(new PostgresError('pool not found'));
    });

    it('should get a client from the pool', async () => {
      // @ts-ignore
      mockPool.connect.mockResolvedValue(mockClient);

      instance.create({ user: 'test', host: 'localhost', database: 'testdb', password: 'secret', port: 5432 });
      const client = await instance[GET_CLIENT]();
      expect(mockPool.connect).toHaveBeenCalled();
      expect(client).toEqual(mockClient);
    });

    it('should throw an error if client is undefined', async () => {
      // @ts-ignore
      mockPool.connect.mockResolvedValue('');

      instance.create({ user: 'test', host: 'localhost', database: 'testdb', password: 'secret', port: 5432 });
      await expect(instance[GET_CLIENT]()).rejects.toThrow(new PostgresError('client not found'));
    });

    it('should throw an error if connect failed', async () => {
      const err = new Error('Connect Error');
      // @ts-ignore
      mockPool.connect.mockRejectedValue(err);

      instance.create({ user: 'test', host: 'localhost', database: 'testdb', password: 'secret', port: 5432 });
      await expect(instance[GET_CLIENT]()).rejects.toThrow(new PostgresError(err, err));
    });
  });

  describe('query', () => {
    let mockQueryWithConfig: jest.Mocked<any>;
    let mockTransactionQueryWithConfig: jest.Mocked<any>;
    let mockQueryWithSubmittable: jest.Mocked<any>;
    let mockTransactionQueryWithSubmittable: jest.Mocked<any>;

    beforeEach(async () => {
      mockQueryWithConfig = jest.fn();
      mockTransactionQueryWithConfig = jest.fn();
      mockQueryWithSubmittable = jest.fn();
      mockTransactionQueryWithSubmittable = jest.fn();
      (instance as any).queryWithConfig = mockQueryWithConfig;
      (instance as any).transactionQueryWithConfig = mockTransactionQueryWithConfig;
      (instance as any).queryWithSubmittable = mockQueryWithSubmittable;
      (instance as any).transactionQueryWithSubmittable = mockTransactionQueryWithSubmittable;
      // @ts-ignore
      mockPool.connect.mockResolvedValue(mockClient);

      instance.create({ user: 'test', host: 'localhost', database: 'testdb', password: 'secret', port: 5432 });
    });

    it('should throw error when no parameters', async () => {
      //@ts-ignore
      await expect(instance.query()).rejects.toThrow(new PostgresError('empty parameters'));
    });

    it('should handle Submittable correctly', async () => {
      const submittable = { submit: () => {} };
      await instance.query(submittable);

      expect(isSubmittable).toHaveBeenCalledWith(submittable);

      expect(mockQueryWithConfig).not.toHaveBeenCalled();
      expect(mockTransactionQueryWithConfig).not.toHaveBeenCalled();
      expect(mockQueryWithSubmittable).toHaveBeenCalledWith(submittable);
      expect(mockTransactionQueryWithSubmittable).not.toHaveBeenCalled();
    });

    it('should handle Submittable with transaction correctly', async () => {
      const submittable = { submit: () => {} };

      await instance[ALS].run({ client: Promise.resolve(mockClient), queries: [] }, async () => {
        return await instance.query(submittable);
      });

      expect(isSubmittable).toHaveBeenCalledWith(submittable);

      expect(mockQueryWithConfig).not.toHaveBeenCalled();
      expect(mockTransactionQueryWithConfig).not.toHaveBeenCalled();
      expect(mockQueryWithSubmittable).not.toHaveBeenCalled();
      expect(mockTransactionQueryWithSubmittable).toHaveBeenCalledWith(submittable);
    });

    it('should handle QueryConfig correctly', async () => {
      const query = 'Select 1=1;';
      await instance.query(query);

      expect(isSubmittable).toHaveBeenCalledWith(query);

      expect(mockQueryWithConfig).toHaveBeenCalledWith(query);
      expect(mockTransactionQueryWithConfig).not.toHaveBeenCalled();
      expect(mockQueryWithSubmittable).not.toHaveBeenCalled();
      expect(mockTransactionQueryWithSubmittable).not.toHaveBeenCalled();
    });

    it('should handle QueryConfig with transaction correctly', async () => {
      const query = 'Select 1=1;';

      await instance[ALS].run({ client: Promise.resolve(mockClient), queries: [] }, async () => {
        return await instance.query(query);
      });

      expect(isSubmittable).toHaveBeenCalledWith(query);

      expect(mockQueryWithConfig).not.toHaveBeenCalled();
      expect(mockTransactionQueryWithConfig).toHaveBeenCalledWith(query);
      expect(mockQueryWithSubmittable).not.toHaveBeenCalled();
      expect(mockTransactionQueryWithSubmittable).not.toHaveBeenCalled();
    });
  });

  describe('queryWithConfig', () => {
    const query = 'SELECT 1';

    beforeEach(() => {
      // @ts-ignore
      mockPool.connect.mockResolvedValue(mockClient);
      instance.create({ user: 'test', host: 'localhost', database: 'testdb', password: 'secret', port: 5432 });
    });

    it('should correctly return and release the client', async () => {
      const result = { rows: [] };
      // @ts-ignore
      mockClient.query.mockResolvedValue(result);
      await expect((instance as any).queryWithConfig(query)).resolves.toBe(result);

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(query);
      expect(mockClient.release).toHaveBeenCalledWith(true);
    });

    it('should correctly handle query errors', async () => {
      const err = new Error('Query error');
      // @ts-ignore
      mockClient.query.mockRejectedValue(err);

      await expect((instance as any).queryWithConfig(query)).rejects.toThrow(new PostgresError(err, err));

      expect(mockClient.query).toHaveBeenCalledWith(query);
      expect(mockClient.release).toHaveBeenCalledWith(err);
    });

    describe('with ALS', () => {
      it('should correctly return and release the client', async () => {
        const store = { client: Promise.resolve(mockClient), queries: [] };
        const result = { rows: [] };
        // @ts-ignore
        mockClient.query.mockResolvedValue(result);
        await expect(
          instance[ALS].run(store, async () => {
            return await (instance as any).transactionQueryWithConfig(query);
          })
        ).resolves.toBe(result);

        expect(mockPool.connect).not.toHaveBeenCalled();
        expect(mockClient.query).toHaveBeenCalledWith(query);
        expect(store.queries.length).toBe(1);
        await expect(store.queries[0]).resolves.toBe(true);
      });

      it('should correctly handle query errors', async () => {
        const err = new Error('Query error');
        // @ts-ignore
        const store = { client: Promise.resolve(mockClient), queries: [] };
        // @ts-ignore
        mockClient.query.mockRejectedValue(err);
        await expect(
          instance[ALS].run(store, async () => {
            return await (instance as any).transactionQueryWithConfig(query);
          })
        ).rejects.toThrow(new PostgresError(err, err));

        expect(mockClient.query).toHaveBeenCalledWith(query);
        expect(store.queries.length).toBe(1);
        await expect(store.queries[0]).resolves.toEqual(new PostgresError(err, err));
      });
    });
  });

  describe('queryWithSubmittable', () => {
    const spyOnce = jest.spyOn(EventEmitter.prototype, 'once');
    const spyOff = jest.spyOn(EventEmitter.prototype, 'off');
    const query = new EventEmitter();

    // @ts-ignore
    query.submit = jest.fn();
    // @ts-ignore
    query.text = 'select 1=1;';

    beforeEach(() => {
      // @ts-ignore
      mockPool.connect.mockResolvedValue(mockClient);
      instance.create({ user: 'test', host: 'localhost', database: 'testdb', password: 'secret', port: 5432 });
    });

    it('should correctly return and release the client', async () => {
      // @ts-ignore
      mockClient.query.mockResolvedValue(query);
      await expect((instance as any).queryWithSubmittable(query)).resolves.toBe(query);

      expect(mockPool.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(query);

      expect(spyOnce).toHaveBeenNthCalledWith(1, 'end', expect.any(Function));
      expect(spyOnce).toHaveBeenNthCalledWith(2, 'error', expect.any(Function));

      query.emit('end');

      expect(spyOff).toHaveBeenNthCalledWith(1, 'error', expect.any(Function));

      expect(mockClient.release).toHaveBeenCalledWith(true);
    });

    it('should correctly handle query errors', async () => {
      const err = new Error('Query error');
      // @ts-ignore
      mockClient.query.mockRejectedValue(err);

      await expect((instance as any).queryWithSubmittable(query)).rejects.toThrow(new PostgresError(err, err));

      expect(mockClient.query).toHaveBeenCalledWith(query);

      expect(mockClient.release).toHaveBeenCalledWith(new PostgresError(err, err));
    });

    it('should correctly handle error event', async () => {
      const err = new Error('Query error');
      // @ts-ignore
      mockClient.query.mockResolvedValue(query);
      await expect((instance as any).queryWithSubmittable(query)).resolves.toBe(query);

      expect(mockClient.query).toHaveBeenCalledWith(query);

      expect(spyOnce).toHaveBeenNthCalledWith(1, 'end', expect.any(Function));
      expect(spyOnce).toHaveBeenNthCalledWith(2, 'error', expect.any(Function));

      query.emit('error', err);

      expect(spyOff).toHaveBeenNthCalledWith(1, 'end', expect.any(Function));

      expect(mockClient.release).toHaveBeenCalledWith(err);
    });

    it('should correctly handle empty returns', async () => {
      // @ts-ignore
      mockClient.query.mockResolvedValue(undefined);

      await expect((instance as any).queryWithSubmittable(query)).resolves.toBeUndefined();

      expect(mockClient.query).toHaveBeenCalledWith(query);

      expect(spyOnce).not.toHaveBeenCalled();

      expect(mockClient.release).toHaveBeenCalledWith(true);
    });

    describe('with ALS', () => {
      it('should correctly return and release the client', async () => {
        const store = { client: Promise.resolve(mockClient), queries: [] };
        // @ts-ignore
        mockClient.query.mockResolvedValue(query);
        await expect(
          instance[ALS].run(store, async () => {
            return await (instance as any).transactionQueryWithSubmittable(query);
          })
        ).resolves.toBe(query);

        expect(mockPool.connect).not.toHaveBeenCalled();
        expect(mockClient.query).toHaveBeenCalledWith(query);

        expect(spyOnce).toHaveBeenNthCalledWith(1, 'end', expect.any(Function));
        expect(spyOnce).toHaveBeenNthCalledWith(2, 'error', expect.any(Function));

        query.emit('end');

        expect(spyOff).toHaveBeenNthCalledWith(1, 'error', expect.any(Function));

        expect(store.queries.length).toBe(1);
        await expect(store.queries[0]).resolves.toBe(true);
      });

      it('should correctly handle query errors', async () => {
        const store = { client: Promise.resolve(mockClient), queries: [] };
        const err = new Error('Query error');
        // @ts-ignore
        mockClient.query.mockRejectedValue(err);

        await expect(
          instance[ALS].run(store, async () => {
            return await (instance as any).transactionQueryWithSubmittable(query);
          })
        ).rejects.toThrow(new PostgresError(err, err));

        expect(mockClient.query).toHaveBeenCalledWith(query);

        expect(spyOnce).not.toHaveBeenCalled();

        expect(store.queries.length).toBe(1);
        await expect(store.queries[0]).resolves.toEqual(new PostgresError(err, err));
      });

      it('should correctly handle empty returns', async () => {
        const store = { client: Promise.resolve(mockClient), queries: [] };
        // @ts-ignore
        mockClient.query.mockResolvedValue(undefined);
        await expect(
          instance[ALS].run(store, async () => {
            return await (instance as any).transactionQueryWithSubmittable(query);
          })
        ).resolves.toBe(undefined);

        expect(mockClient.query).toHaveBeenCalledWith(query);

        expect(spyOnce).not.toHaveBeenCalled();
        expect(spyOff).not.toHaveBeenCalled();

        expect(store.queries.length).toBe(1);
        await expect(store.queries[0]).resolves.toBe(true);
      });

      it('should correctly handle error event', async () => {
        const err = new Error('Query error');
        const store = { client: Promise.resolve(mockClient), queries: [] };
        // @ts-ignore
        mockClient.query.mockResolvedValue(query);
        await expect(
          instance[ALS].run(store, async () => {
            return await (instance as any).transactionQueryWithSubmittable(query);
          })
        ).resolves.toBe(query);

        expect(mockClient.query).toHaveBeenCalledWith(query);

        expect(spyOnce).toHaveBeenNthCalledWith(1, 'end', expect.any(Function));
        expect(spyOnce).toHaveBeenNthCalledWith(2, 'error', expect.any(Function));

        query.emit('error', err);

        expect(spyOff).toHaveBeenNthCalledWith(1, 'end', expect.any(Function));

        expect(store.queries.length).toBe(1);
        await expect(store.queries[0]).resolves.toEqual(err);
      });
    });
  });

  describe('debug mode', () => {
    beforeEach(() => {
      (instance as any).debug = true;
    });

    it('should enable debug mode if process.env.CONNEXTION_POSTGRES_DEBUG is true', () => {
      process.env[CONNEXTION_POSTGRES_DEBUG] = '1';

      expect(new PostgresInstance('test-name', {})['debug']).toBeTruthy();

      delete process.env[CONNEXTION_POSTGRES_DEBUG];
    });

    it('should enable debug mode if debug option is true', () => {
      expect(new PostgresInstance('test-name', { debug: true })['debug']).toBeTruthy();
    });

    it('should not enable debug mode by default', () => {
      expect(new PostgresInstance('test-name', { debug: false })['debug']).toBeFalsy();
    });

    it('should return a proxy in debug mode', async () => {
      // @ts-ignore
      mockPool.connect.mockResolvedValue(mockClient);

      instance.create({ user: 'test', host: 'localhost', database: 'testdb', password: 'secret', port: 5432 });
      const client = await instance[GET_CLIENT]();

      expect(client).not.toBe(mockClient);
    });

    it('should create debug logger in debug mode', async () => {
      // @ts-ignore
      mockPool.connect.mockResolvedValue(mockClient);

      instance.create({ user: 'test', host: 'localhost', database: 'testdb', password: 'secret', port: 5432 });
      const client = await instance[GET_CLIENT]();

      expect(createDebugLogger).toHaveBeenCalledWith(expect.any(Function), (instance as any).debug);
      expect(uid).toHaveBeenCalledWith(21);
      expect(debugFactroy).toHaveBeenCalledWith(
        (instance as any).name,
        jest.mocked(uid).mock.results[0].value,
        jest.mocked(createDebugLogger).mock.results[0].value
      );
    });

    it('should throw an error if client is undefined in debug mode', async () => {
      // @ts-ignore
      mockPool.connect.mockResolvedValue('');

      instance.create({ user: 'test', host: 'localhost', database: 'testdb', password: 'secret', port: 5432 });
      await expect(instance[GET_CLIENT]()).rejects.toThrow(new PostgresError('client not found'));
    });

    it('should throw an error if connect failed in debug mode', async () => {
      const err = new Error('Connect Error');
      // @ts-ignore
      mockPool.connect.mockRejectedValue(err);

      instance.create({ user: 'test', host: 'localhost', database: 'testdb', password: 'secret', port: 5432 });
      await expect(instance[GET_CLIENT]()).rejects.toThrow(new PostgresError(err, err));
      expect(createDebugLogger).toHaveBeenCalled();
      expect(uid).toHaveBeenCalled();
      expect(debugFactroy).toHaveBeenCalled();
    });

    it('should log debug information when getting client in debug mode', async () => {
      // @ts-ignore
      mockPool.connect.mockResolvedValue(mockClient);
      // @ts-ignore
      mockClient.query.mockResolvedValue({ rows: [] });

      instance.create({ user: 'test', host: 'localhost', database: 'testdb', password: 'secret', port: 5432 });

      const client = await instance[GET_CLIENT]();

      expect(mockLogger.debug).toHaveBeenCalledWith(expect.any(String));
    });

    it('should log debug information when calling query in debug mode', async () => {
      // @ts-ignore
      mockPool.connect.mockResolvedValue(mockClient);
      // @ts-ignore
      mockClient.query.mockResolvedValue({ rows: [] });

      instance.create({ user: 'test', host: 'localhost', database: 'testdb', password: 'secret', port: 5432 });

      const client = await instance[GET_CLIENT]();
      await client.query('SELECT 1');

      expect(mockLogger.debug).toHaveBeenCalledWith(expect.any(String));
    });

    it('should log debug information when calling release in debug mode', async () => {
      // @ts-ignore
      mockPool.connect.mockResolvedValue(mockClient);

      instance.create({ user: 'test', host: 'localhost', database: 'testdb', password: 'secret', port: 5432 });

      const client = await instance[GET_CLIENT]();
      client.release();

      expect(mockLogger.debug).toHaveBeenCalledWith(expect.any(String));
    });

    it('should not log debug information when other methods in debug mode', async () => {
      // @ts-ignore
      mockPool.connect.mockResolvedValue(mockClient);

      instance.create({ user: 'test', host: 'localhost', database: 'testdb', password: 'secret', port: 5432 });

      const client = await instance[GET_CLIENT]();
      mockLogger.debug.mockClear();
      // @ts-ignore
      client.end();

      expect(mockLogger.debug).not.toHaveBeenCalled();
    });

    it('should log debug information with custom logger in debug mode', async () => {
      (instance as any).debug = (data: any) => data;
      // @ts-ignore
      mockPool.connect.mockResolvedValue(mockClient);
      // @ts-ignore
      mockClient.query.mockResolvedValue({ rows: [] });

      instance.create({ user: 'test', host: 'localhost', database: 'testdb', password: 'secret', port: 5432 });

      const client = await instance[GET_CLIENT]();
      await client.query('SELECT 1');

      expect(mockLogger.debug).toHaveBeenCalledWith(expect.objectContaining({ Type: 'Query' }));
    });
  });
});
