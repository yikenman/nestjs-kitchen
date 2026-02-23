import { DuckDBInstance } from '@duckdb/node-api';
import { type INestApplication, Injectable } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { defineDuckDB } from '../define-duckdb';
import { DuckDBError } from '../errors';

const sleep = (ms = 50) =>
  new Promise((resolve) =>
    setTimeout(() => {
      resolve(true);
    }, ms)
  );

const { DuckDB, DuckDBModule, Transaction } = defineDuckDB<'instance1' | 'instance2'>();
type DuckDB = InstanceType<typeof DuckDB>;

const { DuckDB: DuckDB2, DuckDBModule: DuckDBModule2, Transaction: Transaction2 } = defineDuckDB();
type DuckDB2 = InstanceType<typeof DuckDB2>;

const queryParams = [
  'select 1 as instance, query as type;',
  'select 2 as instance, query as type;',
  'select default as instance, query as type;'
];

@Injectable()
class TestService {
  constructor(
    private readonly duckDB: DuckDB,
    private readonly duckDB2: DuckDB2
  ) {}

  async complexQuery() {
    await this.duckDB.instance1.run(queryParams[0]);
    await this.duckDB.instance1.run(queryParams[0]);

    await this.duckDB.instance2.run(queryParams[1]);
    await this.duckDB.instance2.run(queryParams[1]);

    await this.duckDB2.default.run(queryParams[2]);
    await this.duckDB2.default.run(queryParams[2]);

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

jest.mock('@duckdb/node-api', () => {
  const actual = jest.requireActual('@duckdb/node-api');
  return {
    ...actual,
    DuckDBInstance: {
      create: jest.fn()
    }
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

describe('Mixed Scenario', () => {
  const result = {};

  let mockInstance: {
    closeSync: jest.Mock;
    connect: jest.Mock;
  };
  let mockCon: {
    run: jest.Mock;
    runAndRead: jest.Mock;
    stream: jest.Mock;
    streamAndRead: jest.Mock;
    disconnectSync: jest.Mock;
  };

  let testService: TestService;
  let app: INestApplication;

  beforeEach(async () => {
    mockCon = {
      run: jest.fn(),
      runAndRead: jest.fn(),
      stream: jest.fn(),
      streamAndRead: jest.fn(),
      disconnectSync: jest.fn()
    };

    mockInstance = {
      closeSync: jest.fn(),
      connect: jest.fn().mockResolvedValue(mockCon)
    };

    jest.mocked(DuckDBInstance.create).mockResolvedValue(mockInstance as unknown as DuckDBInstance);

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        DuckDBModule.register({
          connections: [
            {
              name: 'instance1',
              path: ':memory:'
            },
            {
              name: 'instance2',
              path: ':memory:'
            }
          ]
        }),
        DuckDBModule2.register({
          connections: {
            path: ':memory:'
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
    expect(testService[injectedServices[0]]).toBe(testService['duckDB']);
    expect(testService[injectedServices[1]]).toBe(testService['duckDB2']);
  });

  describe('should handle multiple DuckDB instances and services correctly', () => {
    it('should handle and release if all queries succeed', async () => {
      jest.mocked(mockCon.run).mockImplementation((...rest) => {
        return result;
      });

      await expect(testService.complexQuery()).resolves.toBe(true);

      expect(mockInstance.connect).toHaveBeenCalledTimes(6);

      expect(mockCon.run).toHaveBeenCalledTimes(6);
      expect(mockCon.run).toHaveBeenNthCalledWith(1, queryParams[0]);
      expect(mockCon.run).toHaveBeenNthCalledWith(2, queryParams[0]);
      expect(mockCon.run).toHaveBeenNthCalledWith(3, queryParams[1]);
      expect(mockCon.run).toHaveBeenNthCalledWith(4, queryParams[1]);
      expect(mockCon.run).toHaveBeenNthCalledWith(5, queryParams[2]);
      expect(mockCon.run).toHaveBeenNthCalledWith(6, queryParams[2]);
    });

    it('should handle and release if query failed', async () => {
      const err = new Error('query error');

      jest
        .mocked(mockCon.run)
        .mockResolvedValueOnce(result)
        .mockRejectedValueOnce(err)
        .mockResolvedValueOnce(result)
        .mockResolvedValueOnce(result)
        .mockResolvedValueOnce(result)
        .mockResolvedValueOnce(result);

      await expect(testService.complexQuery()).rejects.toThrow(new DuckDBError(err, err));

      expect(mockInstance.connect).toHaveBeenCalledTimes(2);
    });
  });

  describe('should handle transaction on specificed service correctly', () => {
    it('should handle and release if all queries succeed', async () => {
      jest.mocked(mockCon.run).mockImplementation((...rest) => {
        return result;
      });

      await expect(testService.complexQueryWithOneTransaction()).resolves.toBe(true);

      expect(mockInstance.connect).toHaveBeenCalledTimes(4);

      expect(mockCon.run).toHaveBeenCalledTimes(10);

      expect(mockCon.run).toHaveBeenNthCalledWith(1, 'BEGIN TRANSACTION;');
      expect(mockCon.run).toHaveBeenNthCalledWith(2, 'BEGIN TRANSACTION;');
      expect(mockCon.run).toHaveBeenNthCalledWith(3, queryParams[0]);
      expect(mockCon.run).toHaveBeenNthCalledWith(4, queryParams[0]);
      expect(mockCon.run).toHaveBeenNthCalledWith(5, queryParams[1]);
      expect(mockCon.run).toHaveBeenNthCalledWith(6, queryParams[1]);
      expect(mockCon.run).toHaveBeenNthCalledWith(7, queryParams[2]);
      expect(mockCon.run).toHaveBeenNthCalledWith(8, queryParams[2]);
      expect(mockCon.run).toHaveBeenNthCalledWith(9, 'COMMIT;');
      expect(mockCon.run).toHaveBeenNthCalledWith(10, 'COMMIT;');

      expect(mockCon.disconnectSync).toHaveBeenCalledTimes(2);
      expect(mockCon.disconnectSync).toHaveBeenNthCalledWith(1);
      expect(mockCon.disconnectSync).toHaveBeenNthCalledWith(2);
    });

    it('should handle and release if query failed with service using transaction', async () => {
      const err = new Error('query error');

      let i = 0;

      jest.mocked(mockCon.run).mockImplementation((...rest) => {
        if (typeof rest[0] === 'string' && ['BEGIN TRANSACTION;', 'COMMIT;', 'ROLLBACK;'].includes(rest[0])) {
          return rest[0];
        }

        if (i === 1) {
          throw err;
        }

        i++;

        return result;
      });

      await expect(testService.complexQueryWithOneTransaction()).rejects.toThrow(new DuckDBError(err, err));

      expect(mockInstance.connect).toHaveBeenCalledTimes(2);

      expect(mockCon.run).toHaveBeenCalledTimes(6);

      expect(mockCon.run).toHaveBeenNthCalledWith(1, 'BEGIN TRANSACTION;');
      expect(mockCon.run).toHaveBeenNthCalledWith(2, 'BEGIN TRANSACTION;');
      expect(mockCon.run).toHaveBeenNthCalledWith(3, queryParams[0]);
      expect(mockCon.run).toHaveBeenNthCalledWith(4, queryParams[0]);
      expect(mockCon.run).toHaveBeenNthCalledWith(5, 'ROLLBACK;');
      expect(mockCon.run).toHaveBeenNthCalledWith(6, 'ROLLBACK;');

      expect(mockCon.disconnectSync).toHaveBeenCalledTimes(2);
      expect(mockCon.disconnectSync).toHaveBeenNthCalledWith(1);
      expect(mockCon.disconnectSync).toHaveBeenNthCalledWith(2);
    });

    it('should handle and release if query failed with service not using transaction', async () => {
      const err = new Error('query error');

      let i = 0;

      jest.mocked(mockCon.run).mockImplementation((...rest) => {
        if (typeof rest[0] === 'string' && ['BEGIN TRANSACTION;', 'COMMIT;', 'ROLLBACK;'].includes(rest[0])) {
          return rest[0];
        }

        if (i === 4) {
          throw err;
        }

        i++;

        return result;
      });

      await expect(testService.complexQueryWithOneTransaction()).rejects.toThrow(new DuckDBError(err, err));

      expect(mockInstance.connect).toHaveBeenCalledTimes(3);

      expect(mockCon.run).toHaveBeenCalledTimes(9);

      expect(mockCon.run).toHaveBeenNthCalledWith(1, 'BEGIN TRANSACTION;');
      expect(mockCon.run).toHaveBeenNthCalledWith(2, 'BEGIN TRANSACTION;');
      expect(mockCon.run).toHaveBeenNthCalledWith(3, queryParams[0]);
      expect(mockCon.run).toHaveBeenNthCalledWith(4, queryParams[0]);
      expect(mockCon.run).toHaveBeenNthCalledWith(5, queryParams[1]);
      expect(mockCon.run).toHaveBeenNthCalledWith(6, queryParams[1]);
      expect(mockCon.run).toHaveBeenNthCalledWith(7, queryParams[2]);
      expect(mockCon.run).toHaveBeenNthCalledWith(8, 'ROLLBACK;');
      expect(mockCon.run).toHaveBeenNthCalledWith(9, 'ROLLBACK;');

      expect(mockCon.disconnectSync).toHaveBeenCalledTimes(2);
      expect(mockCon.disconnectSync).toHaveBeenNthCalledWith(1);
      expect(mockCon.disconnectSync).toHaveBeenNthCalledWith(2);
    });
  });

  describe('should handle transaction on specificed instance correctly', () => {
    it('should handle and release if all queries succeed', async () => {
      jest.mocked(mockCon.run).mockImplementation((...rest) => {
        return result;
      });

      await expect(testService.complexQueryWithOneTransactionSpecifiedInstance()).resolves.toBe(true);

      expect(mockInstance.connect).toHaveBeenCalledTimes(5);

      expect(mockCon.run).toHaveBeenCalledTimes(8);

      expect(mockCon.run).toHaveBeenNthCalledWith(1, 'BEGIN TRANSACTION;');
      expect(mockCon.run).toHaveBeenNthCalledWith(2, queryParams[0]);
      expect(mockCon.run).toHaveBeenNthCalledWith(3, queryParams[0]);
      expect(mockCon.run).toHaveBeenNthCalledWith(4, queryParams[1]);
      expect(mockCon.run).toHaveBeenNthCalledWith(5, queryParams[1]);
      expect(mockCon.run).toHaveBeenNthCalledWith(6, queryParams[2]);
      expect(mockCon.run).toHaveBeenNthCalledWith(7, queryParams[2]);
      expect(mockCon.run).toHaveBeenNthCalledWith(8, 'COMMIT;');

      expect(mockCon.disconnectSync).toHaveBeenCalledTimes(1);
      expect(mockCon.disconnectSync).toHaveBeenNthCalledWith(1);
    });

    it('should handle and release if query failed with instance using transaction', async () => {
      const err = new Error('query error');

      let i = 0;

      jest.mocked(mockCon.run).mockImplementation((...rest) => {
        if (typeof rest[0] === 'string' && ['BEGIN TRANSACTION;', 'COMMIT;', 'ROLLBACK;'].includes(rest[0])) {
          return rest[0];
        }

        if (i === 1) {
          throw err;
        }

        i++;

        return result;
      });

      await expect(testService.complexQueryWithOneTransactionSpecifiedInstance()).rejects.toThrow(
        new DuckDBError(err, err)
      );

      expect(mockInstance.connect).toHaveBeenCalledTimes(1);

      expect(mockCon.run).toHaveBeenCalledTimes(4);

      expect(mockCon.run).toHaveBeenNthCalledWith(1, 'BEGIN TRANSACTION;');
      expect(mockCon.run).toHaveBeenNthCalledWith(2, queryParams[0]);
      expect(mockCon.run).toHaveBeenNthCalledWith(3, queryParams[0]);
      expect(mockCon.run).toHaveBeenNthCalledWith(4, 'ROLLBACK;');

      expect(mockCon.disconnectSync).toHaveBeenCalledTimes(1);
      expect(mockCon.disconnectSync).toHaveBeenNthCalledWith(1);
    });

    it('should handle and release if query failed with instance not using transaction', async () => {
      const err = new Error('query error');

      let i = 0;

      jest.mocked(mockCon.run).mockImplementation((...rest) => {
        if (typeof rest[0] === 'string' && ['BEGIN TRANSACTION;', 'COMMIT;', 'ROLLBACK;'].includes(rest[0])) {
          return rest[0];
        }

        if (i === 3) {
          throw err;
        }

        i++;

        return result;
      });

      await expect(testService.complexQueryWithOneTransactionSpecifiedInstance()).rejects.toThrow(
        new DuckDBError(err, err)
      );

      expect(mockInstance.connect).toHaveBeenCalledTimes(3);

      expect(mockCon.run).toHaveBeenCalledTimes(6);

      expect(mockCon.run).toHaveBeenNthCalledWith(1, 'BEGIN TRANSACTION;');
      expect(mockCon.run).toHaveBeenNthCalledWith(2, queryParams[0]);
      expect(mockCon.run).toHaveBeenNthCalledWith(3, queryParams[0]);
      expect(mockCon.run).toHaveBeenNthCalledWith(4, queryParams[1]);
      expect(mockCon.run).toHaveBeenNthCalledWith(5, queryParams[1]);
      expect(mockCon.run).toHaveBeenNthCalledWith(6, 'ROLLBACK;');

      expect(mockCon.disconnectSync).toHaveBeenCalledTimes(1);
      expect(mockCon.disconnectSync).toHaveBeenNthCalledWith(1);
    });
  });

  describe('should handle multiple transactions correctly', () => {
    it('should handle and release if all queries succeed', async () => {
      jest.mocked(mockCon.run).mockImplementation((...rest) => {
        return result;
      });

      await expect(testService.complexQueryWithMultipleTransaction()).resolves.toBe(true);

      expect(mockInstance.connect).toHaveBeenCalledTimes(4);

      expect(mockCon.run).toHaveBeenCalledTimes(10);

      expect(mockCon.run).toHaveBeenNthCalledWith(1, 'BEGIN TRANSACTION;');
      expect(mockCon.run).toHaveBeenNthCalledWith(2, 'BEGIN TRANSACTION;');
      expect(mockCon.run).toHaveBeenNthCalledWith(3, queryParams[0]);
      expect(mockCon.run).toHaveBeenNthCalledWith(4, queryParams[0]);
      expect(mockCon.run).toHaveBeenNthCalledWith(5, queryParams[1]);
      expect(mockCon.run).toHaveBeenNthCalledWith(6, queryParams[1]);
      expect(mockCon.run).toHaveBeenNthCalledWith(7, queryParams[2]);
      expect(mockCon.run).toHaveBeenNthCalledWith(8, queryParams[2]);
      expect(mockCon.run).toHaveBeenNthCalledWith(9, 'COMMIT;');
      expect(mockCon.run).toHaveBeenNthCalledWith(10, 'COMMIT;');

      expect(mockCon.disconnectSync).toHaveBeenCalledTimes(2);
      expect(mockCon.disconnectSync).toHaveBeenNthCalledWith(1);
      expect(mockCon.disconnectSync).toHaveBeenNthCalledWith(2);
    });

    it('should handle and release if query failed with instance using transaction', async () => {
      const err = new Error('query error');

      let i = 0;

      jest.mocked(mockCon.run).mockImplementation((...rest) => {
        if (typeof rest[0] === 'string' && ['BEGIN TRANSACTION;', 'COMMIT;', 'ROLLBACK;'].includes(rest[0])) {
          return rest[0];
        }

        if (i === 4) {
          throw err;
        }

        i++;

        return result;
      });

      await expect(testService.complexQueryWithMultipleTransaction()).rejects.toThrow(new DuckDBError(err, err));

      expect(mockInstance.connect).toHaveBeenCalledTimes(4);

      expect(mockCon.run).toHaveBeenCalledTimes(9);

      expect(mockCon.run).toHaveBeenNthCalledWith(1, 'BEGIN TRANSACTION;');
      expect(mockCon.run).toHaveBeenNthCalledWith(2, 'BEGIN TRANSACTION;');
      expect(mockCon.run).toHaveBeenNthCalledWith(3, queryParams[0]);
      expect(mockCon.run).toHaveBeenNthCalledWith(4, queryParams[0]);
      expect(mockCon.run).toHaveBeenNthCalledWith(5, queryParams[1]);
      expect(mockCon.run).toHaveBeenNthCalledWith(6, queryParams[1]);
      expect(mockCon.run).toHaveBeenNthCalledWith(7, queryParams[2]);
      expect(mockCon.run).toHaveBeenNthCalledWith(8, 'ROLLBACK;');
      expect(mockCon.run).toHaveBeenNthCalledWith(9, 'ROLLBACK;');

      expect(mockCon.disconnectSync).toHaveBeenCalledTimes(2);
      expect(mockCon.disconnectSync).toHaveBeenNthCalledWith(1);
      expect(mockCon.disconnectSync).toHaveBeenNthCalledWith(2);
    });

    it('should handle and release if query failed with instance not using transaction', async () => {
      const err = new Error('query error');

      let i = 0;

      jest.mocked(mockCon.run).mockImplementation((...rest) => {
        if (typeof rest[0] === 'string' && ['BEGIN TRANSACTION;', 'COMMIT;', 'ROLLBACK;'].includes(rest[0])) {
          return rest[0];
        }

        if (i === 2) {
          throw err;
        }

        i++;

        return result;
      });

      await expect(testService.complexQueryWithMultipleTransaction()).rejects.toThrow(new DuckDBError(err, err));

      expect(mockInstance.connect).toHaveBeenCalledTimes(3);

      expect(mockCon.run).toHaveBeenCalledTimes(7);

      expect(mockCon.run).toHaveBeenNthCalledWith(1, 'BEGIN TRANSACTION;');
      expect(mockCon.run).toHaveBeenNthCalledWith(2, 'BEGIN TRANSACTION;');
      expect(mockCon.run).toHaveBeenNthCalledWith(3, queryParams[0]);
      expect(mockCon.run).toHaveBeenNthCalledWith(4, queryParams[0]);
      expect(mockCon.run).toHaveBeenNthCalledWith(5, queryParams[1]);
      expect(mockCon.run).toHaveBeenNthCalledWith(6, 'ROLLBACK;');
      expect(mockCon.run).toHaveBeenNthCalledWith(7, 'ROLLBACK;');

      expect(mockCon.disconnectSync).toHaveBeenCalledTimes(2);
      expect(mockCon.disconnectSync).toHaveBeenNthCalledWith(1);
      expect(mockCon.disconnectSync).toHaveBeenNthCalledWith(2);
    });
  });
});
