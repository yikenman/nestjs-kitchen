import type { AsyncLocalStorage } from 'node:async_hooks';
import { Inject } from '@nestjs/common';
import { ALS, GET_CLIENT } from './constants';
import { createTransaction } from './transaction';
import type { ALSType } from './types';
import {
  copyMethodMetadata,
  getTransactionMetdata,
  normalizeStrings,
  plainPromise,
  setTransactionMetdata
} from './utils';

jest.mock('@nestjs/common', () => {
  const actual = jest.requireActual('@nestjs/common');
  return {
    ...actual,
    Inject: jest.fn(actual.Inject)
  };
});

jest.mock('./utils', () => {
  const actual = jest.requireActual('./utils');
  return {
    ...actual,
    plainPromise: jest.fn(actual.plainPromise),
    copyMethodMetadata: jest.fn(actual.copyMethodMetadata),
    normalizeStrings: jest.fn(actual.normalizeStrings),
    getTransactionMetdata: jest.fn(actual.getTransactionMetdata),
    setTransactionMetdata: jest.fn(actual.setTransactionMetdata)
  };
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();
});

describe('createTransaction', () => {
  let mockPostgres: {
    instanceTokens: {
      validKey1: {};
      validKey2: {};
    };
    validKey1: {
      [GET_CLIENT]: Function;
      [ALS]: AsyncLocalStorage<ALSType>;
    };
    validKey2: {
      [GET_CLIENT]: Function;
      [ALS]: AsyncLocalStorage<ALSType>;
    };
  };
  let Postgres: any;
  let that: {};
  let mockTarget: jest.Mock<any>;
  let mockPropertyDescriptor: {
    value: jest.Mock<any>;
  };
  let Transaction: ReturnType<typeof createTransaction>;

  beforeEach(() => {
    mockPostgres = {
      instanceTokens: {
        validKey1: {},
        validKey2: {}
      },
      validKey1: {
        [GET_CLIENT]: jest.fn(() =>
          Promise.resolve({
            query: jest.fn(),
            release: jest.fn()
          })
        ),
        //@ts-ignore
        [ALS]: {
          run: jest.fn((store, callback) => callback())
        }
      },
      validKey2: {
        [GET_CLIENT]: jest.fn(() =>
          Promise.resolve({
            query: jest.fn(),
            release: jest.fn()
          })
        ),
        //@ts-ignore
        [ALS]: {
          run: jest.fn((store, callback) => callback())
        }
      }
    };

    Postgres = jest.fn(() => mockPostgres);
    Transaction = createTransaction(Postgres);

    that = new Proxy(
      {},
      {
        get(target, prop) {
          if (typeof prop === 'symbol') {
            return mockPostgres;
          }
        }
      }
    );
    mockTarget = jest.fn();
    mockPropertyDescriptor = {
      value: jest.fn()
    };
  });

  it('should return a decorator factory', () => {
    expect(Transaction).toBeDefined();
    expect(typeof Transaction).toBe('function');
  });

  it('should call Inject and inject Postgres', () => {
    const mockInjectFunction = jest.fn();
    jest.mocked(Inject).mockReturnValue(mockInjectFunction);

    const Transaction = createTransaction(Postgres);
    const decorator = Transaction();

    const propertyDescriptor = decorator(mockTarget, 'mockMethod', mockPropertyDescriptor);

    expect(Inject).toHaveBeenCalledWith(Postgres);

    expect(mockInjectFunction).toHaveBeenCalledWith(mockTarget, expect.any(Symbol));
  });

  it('shoud set transaction matadata', () => {
    const Transaction = createTransaction(Postgres);

    const decorator = Transaction();

    const originMethod = mockPropertyDescriptor.value;
    const propertyDescriptor = decorator(mockTarget, 'mockMethod', mockPropertyDescriptor);

    expect(getTransactionMetdata).toHaveBeenCalledTimes(1);
    expect(getTransactionMetdata).toHaveBeenCalledWith(originMethod);

    expect(setTransactionMetdata).toHaveBeenCalledTimes(1);
    expect(setTransactionMetdata).toHaveBeenCalledWith(originMethod);
  });

  it('shoud throw error if reapply multiple times', () => {
    const Transaction = createTransaction(Postgres);

    const decorator = Transaction();

    const propertyDescriptor = decorator(mockTarget, 'mockMethod', mockPropertyDescriptor);

    expect(() => decorator(mockTarget, 'mockMethod', propertyDescriptor)).toThrow(
      'Cannot reapply the same transaction decorator multiple times.'
    );

    expect(getTransactionMetdata).toHaveBeenCalledTimes(2);
  });

  it('should call copyMethodMetadata', () => {
    const Transaction = createTransaction(Postgres);

    const decorator = Transaction();

    const originMethod = mockPropertyDescriptor.value;
    const propertyDescriptor = decorator(mockTarget, 'mockMethod', mockPropertyDescriptor);

    expect(copyMethodMetadata).toHaveBeenCalledWith(originMethod, propertyDescriptor.value);
  });

  it('should override method', () => {
    const Transaction = createTransaction(Postgres);

    const decorator = Transaction();

    const originMethod = mockPropertyDescriptor.value;
    const propertyDescriptor = decorator(mockTarget, 'mockMethod', mockPropertyDescriptor);

    expect(propertyDescriptor.value).not.toBe(originMethod);
  });

  it('should apply transaction to all Postgres instances by default', async () => {
    const decorator = Transaction();
    const propertyDescriptor = decorator(mockTarget, 'mockMethod', mockPropertyDescriptor);

    await propertyDescriptor.value.bind(that)();

    expect(normalizeStrings).toHaveBeenCalledWith(Object.keys(mockPostgres.instanceTokens));
  });

  it('should apply transaction to specified Postgres instances if name was provided', async () => {
    const decorator = Transaction('validKey1');
    const propertyDescriptor = decorator(mockTarget, 'mockMethod', mockPropertyDescriptor);

    await propertyDescriptor.value.bind(that)();

    expect(normalizeStrings).toHaveBeenCalledWith(['validKey1']);
  });

  it('should throw an error for invalid keys', async () => {
    const decorator = Transaction('invalidKey');
    const propertyDescriptor = decorator(mockTarget, 'mockMethod', mockPropertyDescriptor);

    await expect(propertyDescriptor.value.bind(that)()).rejects.toThrow('Invalid keys: invalidKey');
  });

  it('should initialize clients and execute original method', async () => {
    const mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };

    mockPropertyDescriptor.value.mockResolvedValue('result');
    mockPostgres.validKey1[GET_CLIENT] = jest.fn(() => Promise.resolve(mockClient));

    const decorator = Transaction('validKey1');
    const propertyDescriptor = decorator(mockTarget, 'mockMethod', mockPropertyDescriptor);

    const result = await propertyDescriptor.value.bind(that)();

    expect(plainPromise).toHaveBeenCalledTimes(3);
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
    expect(result).toBe('result');
  });

  it('should rollback transaction on error', async () => {
    const mockClient = {
      query: jest.fn(),
      release: jest.fn()
    };

    const err = new Error('Query error');
    mockPropertyDescriptor.value.mockRejectedValue(err);
    mockPostgres.validKey1[GET_CLIENT] = jest.fn(() => Promise.resolve(mockClient));

    const decorator = Transaction('validKey1');
    const propertyDescriptor = decorator(mockTarget, 'mockMethod', mockPropertyDescriptor);

    await expect(propertyDescriptor.value.bind(that)()).rejects.toThrow(err);

    expect(plainPromise).toHaveBeenCalledTimes(3);
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });

  it('should handle nested ALS transactions', async () => {
    const mockClient1 = {
      query: jest.fn(),
      release: jest.fn()
    };
    const mockClient2 = {
      query: jest.fn(),
      release: jest.fn()
    };

    mockPropertyDescriptor.value.mockResolvedValue('nestedResult');
    mockPostgres.validKey1[GET_CLIENT] = jest.fn(() => Promise.resolve(mockClient1));
    mockPostgres.validKey2[GET_CLIENT] = jest.fn(() => Promise.resolve(mockClient2));

    const decorator = Transaction();
    const propertyDescriptor = decorator(mockTarget, 'mockMethod', mockPropertyDescriptor);

    const result = await propertyDescriptor.value.bind(that)();

    expect(result).toBe('nestedResult');
    expect(mockPostgres.validKey1[ALS].run).toHaveBeenCalled();
    expect(mockPostgres.validKey2[ALS].run).toHaveBeenCalled();
  });

  it('should release other connected clients if failed to connect clients', async () => {
    const mockClient1 = {
      query: jest.fn(),
      release: jest.fn()
    };
    const mockClient2 = {
      query: jest.fn(),
      release: jest.fn()
    };

    const err = new Error('query error');
    mockPropertyDescriptor.value.mockResolvedValue('nestedResult');
    mockPostgres.validKey1[GET_CLIENT] = jest.fn(() => Promise.resolve(mockClient1));
    mockPostgres.validKey2[GET_CLIENT] = jest.fn(() => Promise.reject(err));

    const decorator = Transaction();
    const propertyDescriptor = decorator(mockTarget, 'mockMethod', mockPropertyDescriptor);

    await expect(propertyDescriptor.value.bind(that)()).rejects.toThrow(err);

    expect(mockPostgres.validKey1[ALS].run).not.toHaveBeenCalled();
    expect(mockPostgres.validKey2[ALS].run).not.toHaveBeenCalled();

    expect(mockClient1.release).toHaveBeenCalled();
    expect(mockClient2.release).not.toHaveBeenCalled();
  });

  it('should also handle catched query error correctly', async () => {
    const mockClient1 = {
      query: jest.fn(),
      release: jest.fn()
    };
    const mockClient2 = {
      query: jest.fn(),
      release: jest.fn()
    };

    const err = new Error('query error');
    mockPropertyDescriptor.value.mockResolvedValue('nestedResult');
    jest.mocked(mockPostgres.validKey1[ALS].run).mockImplementation((store, cb) => {
      store.queries.push(Promise.resolve(err));
      return cb();
    });
    mockPostgres.validKey1[GET_CLIENT] = jest.fn(() => Promise.resolve(mockClient1));
    mockPostgres.validKey2[GET_CLIENT] = jest.fn(() => Promise.resolve(mockClient2));

    const decorator = Transaction();
    const propertyDescriptor = decorator(mockTarget, 'mockMethod', mockPropertyDescriptor);

    await expect(propertyDescriptor.value.bind(that)()).rejects.toThrow(err);

    expect(mockPostgres.validKey1[ALS].run).toHaveBeenCalled();
    expect(mockPostgres.validKey2[ALS].run).toHaveBeenCalled();

    expect(mockClient1.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient1.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient1.release).toHaveBeenCalled();
    expect(mockClient2.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient2.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient2.release).toHaveBeenCalled();
  });
});
