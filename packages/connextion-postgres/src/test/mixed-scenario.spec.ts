import type { EventEmitter } from 'node:stream';
import { type INestApplication, Injectable } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Pool, Query } from 'pg';
import { definePostgres } from '../define-postgres';
import { PostgresError } from '../errors';
import { isSubmittable } from '../utils';

const sleep = (ms = 50) =>
  new Promise((resolve) =>
    setTimeout(() => {
      resolve(true);
    }, ms)
  );

const { Postgres, PostgresModule, Transaction } = definePostgres<'instance1' | 'instance2'>();
type Postgres = InstanceType<typeof Postgres>;

const { Postgres: Postgres2, PostgresModule: PostgresModule2, Transaction: Transaction2 } = definePostgres();
type Postgres2 = InstanceType<typeof Postgres2>;

const queryParams = [
  'select 1 as instance, query as type;',
  'select 2 as instance, query as type;',
  'select default as instance, query as type;',
  'select 1 as instance, submittable as type;',
  'select 2 as instance, submittable as type;',
  'select default as instance, submittable as type;'
];

@Injectable()
class TestService {
  constructor(
    private readonly postgres: Postgres,
    private readonly postgres2: Postgres2
  ) {}

  async complexQuery() {
    const result1 = await this.postgres.instance1.query(queryParams[0]);
    const result2 = await this.postgres.instance2.query(queryParams[1]);

    const result3 = await this.postgres.instance1.query(new Query(queryParams[3]));
    const result4 = await this.postgres.instance2.query(new Query(queryParams[4]));

    const result5 = await this.postgres2.default.query(queryParams[2]);
    const result6 = await this.postgres2.default.query(new Query(queryParams[5]));

    return true;
  }

  @Transaction()
  complexQueryWithOneTransaction() {
    return this.complexQuery();
  }

  @Transaction('instance1')
  complexQueryWithOneTransactionSpecifiedInstance() {
    return this.complexQuery();
  }

  @Transaction2()
  complexQueryWithMultipleTransaction() {
    return this.complexQueryWithOneTransactionSpecifiedInstance();
  }
}

jest.mock('pg', () => {
  const actual = jest.requireActual('pg');
  return {
    ...actual,
    Pool: jest.fn(actual.Pool),
    Query: jest.fn((...rest) => new actual.Query(...rest))
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

describe('Mixed Scenario', () => {
  const result = { rows: [] };

  let mockPool: jest.Mocked<Pool>;
  let mockClient: {
    on: jest.Mock;
    query: jest.Mock;
    release: jest.Mock;
    end: jest.Mock;
  };
  let testService: TestService;
  let app: INestApplication;

  beforeEach(async () => {
    mockClient = {
      on: jest.fn(),
      query: jest.fn(),
      release: jest.fn(),
      end: jest.fn()
    };

    mockPool = {
      connect: jest.fn().mockResolvedValue(mockClient),
      end: jest.fn(),
      on: jest.fn(),
      off: jest.fn()
    } as unknown as jest.Mocked<Pool>;

    jest.mocked(Pool).mockImplementation(() => mockPool);

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        PostgresModule.register({
          connections: [
            {
              name: 'instance1',
              host: 'instance_1_host'
            },
            {
              name: 'instance2',
              host: 'instance_2_host'
            }
          ]
        }),
        PostgresModule2.register({
          connections: {
            host: 'instance_3_host'
          }
        })
      ],
      providers: [TestService]
    }).compile();

    app = module.createNestApplication();
    await app.init();

    testService = module.get(TestService);
  });

  afterEach(async () => {
    await app.close();
  });

  it('should inject multiple services correctly', async () => {
    const injectedServices = Object.getOwnPropertySymbols(testService);
    expect(injectedServices.length).toBe(2);
    expect(testService[injectedServices[0]]).toBe(testService['postgres']);
    expect(testService[injectedServices[1]]).toBe(testService['postgres2']);
  });

  describe('should handle multiple Postage instances and services correctly', () => {
    it('should handle and release if all queries succeed', async () => {
      jest.mocked(mockClient.query).mockImplementation((...rest) => {
        if (isSubmittable(rest[0])) {
          return rest[0];
        }
        return result;
      });

      await expect(testService.complexQuery()).resolves.toBe(true);

      expect(mockPool.connect).toHaveBeenCalledTimes(6);

      const submittables: EventEmitter[] = jest.mocked(Query).mock.results.map((ele) => ele.value);

      expect(Query).toHaveBeenCalledTimes(3);
      expect(Query).toHaveBeenNthCalledWith(1, queryParams[3]);
      expect(Query).toHaveBeenNthCalledWith(2, queryParams[4]);
      expect(Query).toHaveBeenNthCalledWith(3, queryParams[5]);

      expect(mockClient.query).toHaveBeenCalledTimes(6);
      expect(mockClient.query).toHaveBeenNthCalledWith(1, queryParams[0]);
      expect(mockClient.query).toHaveBeenNthCalledWith(2, queryParams[1]);
      expect(mockClient.query).toHaveBeenNthCalledWith(3, jest.mocked(Query).mock.results[0].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(4, jest.mocked(Query).mock.results[1].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(5, queryParams[2]);
      expect(mockClient.query).toHaveBeenNthCalledWith(6, jest.mocked(Query).mock.results[2].value);

      expect(mockClient.release).toHaveBeenCalledTimes(3);
      expect(mockClient.release).toHaveBeenNthCalledWith(1, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(2, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(3, true);

      submittables.forEach((ele) => ele.emit('end'));

      expect(mockClient.release).toHaveBeenCalledTimes(6);
      expect(mockClient.release).toHaveBeenNthCalledWith(4, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(5, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(6, true);
    });

    it('should handle and release if query failed', async () => {
      const err = new Error('query error');

      jest
        .mocked(mockClient.query)
        .mockResolvedValueOnce(result)
        .mockRejectedValueOnce(err)
        .mockResolvedValueOnce(result)
        .mockImplementation((ele) => ele);

      await expect(testService.complexQuery()).rejects.toThrow(new PostgresError(err, err));

      expect(mockPool.connect).toHaveBeenCalledTimes(2);

      expect(mockClient.release).toHaveBeenCalledTimes(2);
      expect(mockClient.release).toHaveBeenNthCalledWith(1, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(2, new PostgresError(err, err));
    });

    it('should handle and release if submittable failed', async () => {
      const err = new Error('query error');

      jest.mocked(mockClient.query).mockImplementation((...rest) => {
        if (isSubmittable(rest[0])) {
          return rest[0];
        }
        return result;
      });

      await expect(testService.complexQuery()).resolves.toBe(true);

      expect(mockPool.connect).toHaveBeenCalledTimes(6);

      const submittables: EventEmitter[] = jest.mocked(Query).mock.results.map((ele) => ele.value);

      expect(mockClient.release).toHaveBeenCalledTimes(3);
      expect(mockClient.release).toHaveBeenNthCalledWith(1, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(2, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(3, true);

      submittables.forEach((ele, i) => (i === 0 ? ele.emit('error', err) : ele.emit('end')));

      expect(mockClient.release).toHaveBeenCalledTimes(6);
      expect(mockClient.release).toHaveBeenNthCalledWith(4, new PostgresError(err, err));
      expect(mockClient.release).toHaveBeenNthCalledWith(5, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(6, true);
    });
  });

  describe('should handle transaction on specificed service correctly', () => {
    it('should handle and release if all queries succeed', async () => {
      jest.mocked(mockClient.query).mockImplementation((...rest) => {
        if (isSubmittable(rest[0])) {
          setTimeout(() => {
            rest[0].emit('end');
          }, 50);
          return rest[0];
        }
        if (typeof rest[0] === 'string' && ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(rest[0])) {
          return rest[0];
        }
        return result;
      });

      await expect(testService.complexQueryWithOneTransaction()).resolves.toBe(true);

      expect(mockPool.connect).toHaveBeenCalledTimes(4);

      expect(mockClient.query).toHaveBeenCalledTimes(10);

      expect(Query).toHaveBeenCalledTimes(3);
      expect(Query).toHaveBeenNthCalledWith(1, queryParams[3]);
      expect(Query).toHaveBeenNthCalledWith(2, queryParams[4]);
      expect(Query).toHaveBeenNthCalledWith(3, queryParams[5]);

      expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(2, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(3, queryParams[0]);
      expect(mockClient.query).toHaveBeenNthCalledWith(4, queryParams[1]);
      expect(mockClient.query).toHaveBeenNthCalledWith(5, jest.mocked(Query).mock.results[0].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(6, jest.mocked(Query).mock.results[1].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(7, queryParams[2]);
      expect(mockClient.query).toHaveBeenNthCalledWith(8, jest.mocked(Query).mock.results[2].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(9, 'COMMIT');
      expect(mockClient.query).toHaveBeenNthCalledWith(10, 'COMMIT');

      expect(mockClient.release).toHaveBeenCalledTimes(3);
      expect(mockClient.release).toHaveBeenNthCalledWith(1, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(2, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(3, true);

      await sleep();
      expect(mockClient.release).toHaveBeenNthCalledWith(4, true);
    });

    it('should handle and release if query failed with service using transaction', async () => {
      const err = new Error('query error');

      let i = 0;

      jest.mocked(mockClient.query).mockImplementation((...rest) => {
        if (isSubmittable(rest[0])) {
          setTimeout(() => {
            rest[0].emit('end');
          }, 50);
          return rest[0];
        }
        if (typeof rest[0] === 'string' && ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(rest[0])) {
          return rest[0];
        }

        if (i === 1) {
          throw err;
        }

        i++;

        return result;
      });

      await expect(testService.complexQueryWithOneTransaction()).rejects.toThrow(new PostgresError(err, err));

      expect(mockPool.connect).toHaveBeenCalledTimes(2);

      expect(mockClient.query).toHaveBeenCalledTimes(6);

      expect(Query).not.toHaveBeenCalled();

      expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(2, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(3, queryParams[0]);
      expect(mockClient.query).toHaveBeenNthCalledWith(4, queryParams[1]);
      expect(mockClient.query).toHaveBeenNthCalledWith(5, 'ROLLBACK');
      expect(mockClient.query).toHaveBeenNthCalledWith(6, 'ROLLBACK');

      expect(mockClient.release).toHaveBeenCalledTimes(2);
      expect(mockClient.release).toHaveBeenNthCalledWith(1, new PostgresError(err, err));
      expect(mockClient.release).toHaveBeenNthCalledWith(2, new PostgresError(err, err));
    });

    it('should handle and release if query failed with service not using transaction', async () => {
      const err = new Error('query error');

      let i = 0;

      jest.mocked(mockClient.query).mockImplementation((...rest) => {
        if (isSubmittable(rest[0])) {
          setTimeout(() => {
            rest[0].emit('end');
          }, 50);
          return rest[0];
        }
        if (typeof rest[0] === 'string' && ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(rest[0])) {
          return rest[0];
        }

        if (i === 2) {
          throw err;
        }

        i++;

        return result;
      });

      await expect(testService.complexQueryWithOneTransaction()).rejects.toThrow(new PostgresError(err, err));

      expect(mockPool.connect).toHaveBeenCalledTimes(3);

      expect(mockClient.query).toHaveBeenCalledTimes(9);

      expect(Query).toHaveBeenCalledTimes(2);
      expect(Query).toHaveBeenNthCalledWith(1, queryParams[3]);
      expect(Query).toHaveBeenNthCalledWith(2, queryParams[4]);

      expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(2, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(3, queryParams[0]);
      expect(mockClient.query).toHaveBeenNthCalledWith(4, queryParams[1]);
      expect(mockClient.query).toHaveBeenNthCalledWith(5, jest.mocked(Query).mock.results[0].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(6, jest.mocked(Query).mock.results[1].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(7, queryParams[2]);
      expect(mockClient.query).toHaveBeenNthCalledWith(8, 'ROLLBACK');
      expect(mockClient.query).toHaveBeenNthCalledWith(9, 'ROLLBACK');

      expect(mockClient.release).toHaveBeenCalledTimes(3);
      expect(mockClient.release).toHaveBeenNthCalledWith(1, new PostgresError(err, err));
      expect(mockClient.release).toHaveBeenNthCalledWith(2, new PostgresError(err, err));
      expect(mockClient.release).toHaveBeenNthCalledWith(3, new PostgresError(err, err));
    });

    it('should handle and release if submittable failed with service using transaction', async () => {
      const err = new Error('query error');

      let i = 0;

      jest.mocked(mockClient.query).mockImplementation((...rest) => {
        if (isSubmittable(rest[0])) {
          setTimeout(() => {
            if (i === 1) {
              rest[0].emit('error', err);
            } else {
              rest[0].emit('end');
            }
            i++;
            return;
          }, 50);
          return rest[0];
        }
        if (typeof rest[0] === 'string' && ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(rest[0])) {
          return rest[0];
        }
        return result;
      });

      await expect(testService.complexQueryWithOneTransaction()).rejects.toThrow(new PostgresError(err, err));

      expect(mockPool.connect).toHaveBeenCalledTimes(4);

      expect(mockClient.query).toHaveBeenCalledTimes(10);

      expect(Query).toHaveBeenCalledTimes(3);
      expect(Query).toHaveBeenNthCalledWith(1, queryParams[3]);
      expect(Query).toHaveBeenNthCalledWith(2, queryParams[4]);
      expect(Query).toHaveBeenNthCalledWith(3, queryParams[5]);

      expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(2, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(3, queryParams[0]);
      expect(mockClient.query).toHaveBeenNthCalledWith(4, queryParams[1]);
      expect(mockClient.query).toHaveBeenNthCalledWith(5, jest.mocked(Query).mock.results[0].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(6, jest.mocked(Query).mock.results[1].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(7, queryParams[2]);
      expect(mockClient.query).toHaveBeenNthCalledWith(8, jest.mocked(Query).mock.results[2].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(9, 'ROLLBACK');
      expect(mockClient.query).toHaveBeenNthCalledWith(10, 'ROLLBACK');

      expect(mockClient.release).toHaveBeenCalledTimes(3);
      expect(mockClient.release).toHaveBeenNthCalledWith(1, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(2, new PostgresError(err, err));
      expect(mockClient.release).toHaveBeenNthCalledWith(3, new PostgresError(err, err));

      await sleep();
      expect(mockClient.release).toHaveBeenCalledTimes(4);
      expect(mockClient.release).toHaveBeenNthCalledWith(4, true);
    });

    it('should handle and release if submittable failed with service not using transaction', async () => {
      const err = new Error('query error');

      let i = 0;

      jest.mocked(mockClient.query).mockImplementation((...rest) => {
        if (isSubmittable(rest[0])) {
          setTimeout(() => {
            if (i === 2) {
              rest[0].emit('error', err);
            } else {
              rest[0].emit('end');
            }
            i++;
            return;
          }, 50);
          return rest[0];
        }
        if (typeof rest[0] === 'string' && ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(rest[0])) {
          return rest[0];
        }
        return result;
      });

      await expect(testService.complexQueryWithOneTransaction()).resolves.toBe(true);

      expect(mockPool.connect).toHaveBeenCalledTimes(4);

      expect(mockClient.query).toHaveBeenCalledTimes(10);

      expect(Query).toHaveBeenCalledTimes(3);
      expect(Query).toHaveBeenNthCalledWith(1, queryParams[3]);
      expect(Query).toHaveBeenNthCalledWith(2, queryParams[4]);
      expect(Query).toHaveBeenNthCalledWith(3, queryParams[5]);

      expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(2, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(3, queryParams[0]);
      expect(mockClient.query).toHaveBeenNthCalledWith(4, queryParams[1]);
      expect(mockClient.query).toHaveBeenNthCalledWith(5, jest.mocked(Query).mock.results[0].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(6, jest.mocked(Query).mock.results[1].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(7, queryParams[2]);
      expect(mockClient.query).toHaveBeenNthCalledWith(8, jest.mocked(Query).mock.results[2].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(9, 'COMMIT');
      expect(mockClient.query).toHaveBeenNthCalledWith(10, 'COMMIT');

      expect(mockClient.release).toHaveBeenCalledTimes(3);
      expect(mockClient.release).toHaveBeenNthCalledWith(1, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(2, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(3, true);

      await sleep();
      expect(mockClient.release).toHaveBeenCalledTimes(4);
      expect(mockClient.release).toHaveBeenNthCalledWith(4, new PostgresError(err, err));
    });
  });

  describe('should handle transaction on specificed instance correctly', () => {
    it('should handle and release if all queries succeed', async () => {
      jest.mocked(mockClient.query).mockImplementation((...rest) => {
        if (isSubmittable(rest[0])) {
          setTimeout(() => {
            rest[0].emit('end');
          }, 50);
          return rest[0];
        }
        if (typeof rest[0] === 'string' && ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(rest[0])) {
          return rest[0];
        }
        return result;
      });

      await expect(testService.complexQueryWithOneTransactionSpecifiedInstance()).resolves.toBe(true);

      expect(mockPool.connect).toHaveBeenCalledTimes(5);

      expect(mockClient.query).toHaveBeenCalledTimes(8);

      expect(Query).toHaveBeenCalledTimes(3);
      expect(Query).toHaveBeenNthCalledWith(1, queryParams[3]);
      expect(Query).toHaveBeenNthCalledWith(2, queryParams[4]);
      expect(Query).toHaveBeenNthCalledWith(3, queryParams[5]);

      expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(2, queryParams[0]);
      expect(mockClient.query).toHaveBeenNthCalledWith(3, queryParams[1]);
      expect(mockClient.query).toHaveBeenNthCalledWith(4, jest.mocked(Query).mock.results[0].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(5, jest.mocked(Query).mock.results[1].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(6, queryParams[2]);
      expect(mockClient.query).toHaveBeenNthCalledWith(7, jest.mocked(Query).mock.results[2].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(8, 'COMMIT');

      expect(mockClient.release).toHaveBeenCalledTimes(3);
      expect(mockClient.release).toHaveBeenNthCalledWith(1, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(2, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(3, true);

      await sleep();
      expect(mockClient.release).toHaveBeenCalledTimes(5);
      expect(mockClient.release).toHaveBeenNthCalledWith(4, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(5, true);
    });

    it('should handle and release if query failed with service using transaction', async () => {
      const err = new Error('query error');

      let i = 0;

      jest.mocked(mockClient.query).mockImplementation((...rest) => {
        if (isSubmittable(rest[0])) {
          setTimeout(() => {
            rest[0].emit('end');
          }, 50);
          return rest[0];
        }
        if (typeof rest[0] === 'string' && ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(rest[0])) {
          return rest[0];
        }

        if (i === 0) {
          throw err;
        }

        i++;

        return result;
      });

      await expect(testService.complexQueryWithOneTransactionSpecifiedInstance()).rejects.toThrow(
        new PostgresError(err, err)
      );

      expect(mockPool.connect).toHaveBeenCalledTimes(1);

      expect(mockClient.query).toHaveBeenCalledTimes(3);

      expect(Query).not.toHaveBeenCalled();

      expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(2, queryParams[0]);
      expect(mockClient.query).toHaveBeenNthCalledWith(3, 'ROLLBACK');

      expect(mockClient.release).toHaveBeenCalledTimes(1);
      expect(mockClient.release).toHaveBeenNthCalledWith(1, new PostgresError(err, err));
    });

    it('should handle and release if query failed with service not using transaction', async () => {
      const err = new Error('query error');

      let i = 0;

      jest.mocked(mockClient.query).mockImplementation((...rest) => {
        if (isSubmittable(rest[0])) {
          setTimeout(() => {
            rest[0].emit('end');
          }, 50);
          return rest[0];
        }
        if (typeof rest[0] === 'string' && ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(rest[0])) {
          return rest[0];
        }

        if (i === 2) {
          throw err;
        }

        i++;

        return result;
      });

      await expect(testService.complexQueryWithOneTransactionSpecifiedInstance()).rejects.toThrow(
        new PostgresError(err, err)
      );

      expect(mockPool.connect).toHaveBeenCalledTimes(4);

      expect(mockClient.query).toHaveBeenCalledTimes(7);

      expect(Query).toHaveBeenCalledTimes(2);
      expect(Query).toHaveBeenNthCalledWith(1, queryParams[3]);
      expect(Query).toHaveBeenNthCalledWith(2, queryParams[4]);

      expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(2, queryParams[0]);
      expect(mockClient.query).toHaveBeenNthCalledWith(3, queryParams[1]);
      expect(mockClient.query).toHaveBeenNthCalledWith(4, jest.mocked(Query).mock.results[0].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(5, jest.mocked(Query).mock.results[1].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(6, queryParams[2]);
      expect(mockClient.query).toHaveBeenNthCalledWith(7, 'ROLLBACK');

      expect(mockClient.release).toHaveBeenCalledTimes(3);
      expect(mockClient.release).toHaveBeenNthCalledWith(1, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(2, new PostgresError(err, err));
      expect(mockClient.release).toHaveBeenNthCalledWith(3, new PostgresError(err, err));

      await sleep();
      expect(mockClient.release).toHaveBeenCalledTimes(4);
      expect(mockClient.release).toHaveBeenNthCalledWith(4, true);
    });

    it('should handle and release if submittable failed with service using transaction', async () => {
      const err = new Error('query error');

      let i = 0;

      jest.mocked(mockClient.query).mockImplementation((...rest) => {
        if (isSubmittable(rest[0])) {
          setTimeout(() => {
            if (i === 0) {
              rest[0].emit('error', err);
            } else {
              rest[0].emit('end');
            }
            i++;
            return;
          }, 50);
          return rest[0];
        }
        if (typeof rest[0] === 'string' && ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(rest[0])) {
          return rest[0];
        }
        return result;
      });

      await expect(testService.complexQueryWithOneTransactionSpecifiedInstance()).rejects.toThrow(
        new PostgresError(err, err)
      );

      expect(mockPool.connect).toHaveBeenCalledTimes(5);

      expect(mockClient.query).toHaveBeenCalledTimes(8);

      expect(Query).toHaveBeenCalledTimes(3);
      expect(Query).toHaveBeenNthCalledWith(1, queryParams[3]);
      expect(Query).toHaveBeenNthCalledWith(2, queryParams[4]);
      expect(Query).toHaveBeenNthCalledWith(3, queryParams[5]);

      expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(2, queryParams[0]);
      expect(mockClient.query).toHaveBeenNthCalledWith(3, queryParams[1]);
      expect(mockClient.query).toHaveBeenNthCalledWith(4, jest.mocked(Query).mock.results[0].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(5, jest.mocked(Query).mock.results[1].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(6, queryParams[2]);
      expect(mockClient.query).toHaveBeenNthCalledWith(7, jest.mocked(Query).mock.results[2].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(8, 'ROLLBACK');

      expect(mockClient.release).toHaveBeenCalledTimes(3);
      expect(mockClient.release).toHaveBeenNthCalledWith(1, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(2, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(3, new PostgresError(err, err));

      await sleep();
      expect(mockClient.release).toHaveBeenCalledTimes(5);
      expect(mockClient.release).toHaveBeenNthCalledWith(4, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(5, true);
    });

    it('should handle and release if submittable failed with service not using transaction', async () => {
      const err = new Error('query error');

      let i = 0;

      jest.mocked(mockClient.query).mockImplementation((...rest) => {
        if (isSubmittable(rest[0])) {
          setTimeout(() => {
            if (i === 2) {
              rest[0].emit('error', err);
            } else {
              rest[0].emit('end');
            }
            i++;
            return;
          }, 50);
          return rest[0];
        }
        if (typeof rest[0] === 'string' && ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(rest[0])) {
          return rest[0];
        }
        return result;
      });

      await expect(testService.complexQueryWithOneTransactionSpecifiedInstance()).resolves.toBe(true);

      expect(mockPool.connect).toHaveBeenCalledTimes(5);

      expect(mockClient.query).toHaveBeenCalledTimes(8);

      expect(Query).toHaveBeenCalledTimes(3);
      expect(Query).toHaveBeenNthCalledWith(1, queryParams[3]);
      expect(Query).toHaveBeenNthCalledWith(2, queryParams[4]);
      expect(Query).toHaveBeenNthCalledWith(3, queryParams[5]);

      expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(2, queryParams[0]);
      expect(mockClient.query).toHaveBeenNthCalledWith(3, queryParams[1]);
      expect(mockClient.query).toHaveBeenNthCalledWith(4, jest.mocked(Query).mock.results[0].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(5, jest.mocked(Query).mock.results[1].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(6, queryParams[2]);
      expect(mockClient.query).toHaveBeenNthCalledWith(7, jest.mocked(Query).mock.results[2].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(8, 'COMMIT');

      expect(mockClient.release).toHaveBeenCalledTimes(3);
      expect(mockClient.release).toHaveBeenNthCalledWith(1, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(2, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(3, true);

      await sleep();
      expect(mockClient.release).toHaveBeenCalledTimes(5);
      expect(mockClient.release).toHaveBeenNthCalledWith(4, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(5, new PostgresError(err, err));
    });
  });

  describe('should handle multiple transactions correctly', () => {
    it('should handle and release if all queries succeed', async () => {
      let i = 0;

      jest.mocked(mockClient.query).mockImplementation((...rest) => {
        if (isSubmittable(rest[0])) {
          setTimeout(
            () => {
              rest[0].emit('end');
            },
            i === 1 ? 100 : 50
          );
          i++;
          return rest[0];
        }
        if (typeof rest[0] === 'string' && ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(rest[0])) {
          return rest[0];
        }
        return result;
      });

      await expect(testService.complexQueryWithMultipleTransaction()).resolves.toBe(true);

      expect(mockPool.connect).toHaveBeenCalledTimes(4);

      expect(mockClient.query).toHaveBeenCalledTimes(10);

      expect(Query).toHaveBeenCalledTimes(3);
      expect(Query).toHaveBeenNthCalledWith(1, queryParams[3]);
      expect(Query).toHaveBeenNthCalledWith(2, queryParams[4]);
      expect(Query).toHaveBeenNthCalledWith(3, queryParams[5]);

      expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(2, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(3, queryParams[0]);
      expect(mockClient.query).toHaveBeenNthCalledWith(4, queryParams[1]);
      expect(mockClient.query).toHaveBeenNthCalledWith(5, jest.mocked(Query).mock.results[0].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(6, jest.mocked(Query).mock.results[1].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(7, queryParams[2]);
      expect(mockClient.query).toHaveBeenNthCalledWith(8, jest.mocked(Query).mock.results[2].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(9, 'COMMIT');
      expect(mockClient.query).toHaveBeenNthCalledWith(10, 'COMMIT');

      expect(mockClient.release).toHaveBeenCalledTimes(3);
      expect(mockClient.release).toHaveBeenNthCalledWith(1, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(2, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(3, true);

      await sleep();

      expect(mockClient.release).toHaveBeenNthCalledWith(4, true);
    });

    it('should handle and release if query failed with service using transaction', async () => {
      const err = new Error('query error');

      let i = 0;
      let j = 0;

      jest.mocked(mockClient.query).mockImplementation((...rest) => {
        if (isSubmittable(rest[0])) {
          setTimeout(
            () => {
              rest[0].emit('end');
            },
            i === 1 ? 100 : 50
          );
          i++;
          return rest[0];
        }
        if (typeof rest[0] === 'string' && ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(rest[0])) {
          return rest[0];
        }

        if (j === 0) {
          throw err;
        }

        j++;

        return result;
      });

      await expect(testService.complexQueryWithMultipleTransaction()).rejects.toThrow(new PostgresError(err, err));

      expect(mockPool.connect).toHaveBeenCalledTimes(2);

      expect(mockClient.query).toHaveBeenCalledTimes(5);

      expect(Query).not.toHaveBeenCalled();

      expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(2, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(3, queryParams[0]);
      expect(mockClient.query).toHaveBeenNthCalledWith(4, 'ROLLBACK');
      expect(mockClient.query).toHaveBeenNthCalledWith(5, 'ROLLBACK');

      expect(mockClient.release).toHaveBeenCalledTimes(2);
      expect(mockClient.release).toHaveBeenNthCalledWith(1, new PostgresError(err, err));
      expect(mockClient.release).toHaveBeenNthCalledWith(2, new PostgresError(err, err));
    });

    it('should handle and release if query failed with service not using transaction', async () => {
      const err = new Error('query error');

      let i = 0;
      let j = 0;

      jest.mocked(mockClient.query).mockImplementation((...rest) => {
        if (isSubmittable(rest[0])) {
          setTimeout(
            () => {
              rest[0].emit('end');
            },
            i === 1 ? 100 : 50
          );
          i++;
          return rest[0];
        }
        if (typeof rest[0] === 'string' && ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(rest[0])) {
          return rest[0];
        }

        if (j === 1) {
          throw err;
        }

        j++;

        return result;
      });

      await expect(testService.complexQueryWithMultipleTransaction()).rejects.toThrow(new PostgresError(err, err));

      expect(mockPool.connect).toHaveBeenCalledTimes(3);

      expect(mockClient.query).toHaveBeenCalledTimes(6);

      expect(Query).not.toHaveBeenCalled();

      expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(2, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(3, queryParams[0]);
      expect(mockClient.query).toHaveBeenNthCalledWith(4, queryParams[1]);
      expect(mockClient.query).toHaveBeenNthCalledWith(5, 'ROLLBACK');
      expect(mockClient.query).toHaveBeenNthCalledWith(6, 'ROLLBACK');

      expect(mockClient.release).toHaveBeenCalledTimes(3);
      expect(mockClient.release).toHaveBeenNthCalledWith(1, new PostgresError(err, err));
      expect(mockClient.release).toHaveBeenNthCalledWith(2, new PostgresError(err, err));
      expect(mockClient.release).toHaveBeenNthCalledWith(3, new PostgresError(err, err));
    });

    it('should handle and release if submittable failed with service using transaction', async () => {
      const err = new Error('query error');

      let i = 0;

      jest.mocked(mockClient.query).mockImplementation((...rest) => {
        if (isSubmittable(rest[0])) {
          if (i === 0) {
            setTimeout(() => {
              rest[0].emit('error', err);
              return;
            }, 50);
          } else {
            setTimeout(
              () => {
                rest[0].emit('end');
                return;
              },
              i === 1 ? 100 : 50
            );
          }

          i++;
          return rest[0];
        }
        if (typeof rest[0] === 'string' && ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(rest[0])) {
          return rest[0];
        }
        return result;
      });

      await expect(testService.complexQueryWithMultipleTransaction()).rejects.toThrow(new PostgresError(err, err));

      expect(mockPool.connect).toHaveBeenCalledTimes(4);

      expect(mockClient.query).toHaveBeenCalledTimes(10);

      expect(Query).toHaveBeenCalledTimes(3);
      expect(Query).toHaveBeenNthCalledWith(1, queryParams[3]);
      expect(Query).toHaveBeenNthCalledWith(2, queryParams[4]);
      expect(Query).toHaveBeenNthCalledWith(3, queryParams[5]);

      expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(2, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(3, queryParams[0]);
      expect(mockClient.query).toHaveBeenNthCalledWith(4, queryParams[1]);
      expect(mockClient.query).toHaveBeenNthCalledWith(5, jest.mocked(Query).mock.results[0].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(6, jest.mocked(Query).mock.results[1].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(7, queryParams[2]);
      expect(mockClient.query).toHaveBeenNthCalledWith(8, jest.mocked(Query).mock.results[2].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(9, 'ROLLBACK');
      expect(mockClient.query).toHaveBeenNthCalledWith(10, 'ROLLBACK');

      expect(mockClient.release).toHaveBeenCalledTimes(3);
      expect(mockClient.release).toHaveBeenNthCalledWith(1, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(2, new PostgresError(err, err));
      expect(mockClient.release).toHaveBeenNthCalledWith(3, new PostgresError(err, err));

      await sleep();
      expect(mockClient.release).toHaveBeenCalledTimes(4);
      expect(mockClient.release).toHaveBeenNthCalledWith(4, true);
    });

    it('should handle and release if submittable failed with service not using transaction', async () => {
      const err = new Error('query error');

      let i = 0;

      jest.mocked(mockClient.query).mockImplementation((...rest) => {
        if (isSubmittable(rest[0])) {
          if (i === 1) {
            setTimeout(() => {
              rest[0].emit('error', err);
              return;
            }, 100);
          } else {
            setTimeout(() => {
              rest[0].emit('end');
              return;
            }, 50);
          }
          i++;
          return rest[0];
        }
        if (typeof rest[0] === 'string' && ['BEGIN', 'COMMIT', 'ROLLBACK'].includes(rest[0])) {
          return rest[0];
        }
        return result;
      });

      await expect(testService.complexQueryWithMultipleTransaction()).resolves.toBe(true);

      expect(mockPool.connect).toHaveBeenCalledTimes(4);

      expect(mockClient.query).toHaveBeenCalledTimes(10);

      expect(Query).toHaveBeenCalledTimes(3);
      expect(Query).toHaveBeenNthCalledWith(1, queryParams[3]);
      expect(Query).toHaveBeenNthCalledWith(2, queryParams[4]);
      expect(Query).toHaveBeenNthCalledWith(3, queryParams[5]);

      expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(2, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(3, queryParams[0]);
      expect(mockClient.query).toHaveBeenNthCalledWith(4, queryParams[1]);
      expect(mockClient.query).toHaveBeenNthCalledWith(5, jest.mocked(Query).mock.results[0].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(6, jest.mocked(Query).mock.results[1].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(7, queryParams[2]);
      expect(mockClient.query).toHaveBeenNthCalledWith(8, jest.mocked(Query).mock.results[2].value);
      expect(mockClient.query).toHaveBeenNthCalledWith(9, 'COMMIT');
      expect(mockClient.query).toHaveBeenNthCalledWith(10, 'COMMIT');

      expect(mockClient.release).toHaveBeenCalledTimes(3);
      expect(mockClient.release).toHaveBeenNthCalledWith(1, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(2, true);
      expect(mockClient.release).toHaveBeenNthCalledWith(3, true);

      await sleep();
      expect(mockClient.release).toHaveBeenCalledTimes(4);
      expect(mockClient.release).toHaveBeenNthCalledWith(4, new PostgresError(err, err));
    });
  });
});
