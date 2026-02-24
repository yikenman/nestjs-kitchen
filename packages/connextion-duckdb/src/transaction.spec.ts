import type { AsyncLocalStorage } from 'node:async_hooks';
import { Inject } from '@nestjs/common';
import { ALS, GET_CON } from './constants';
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
  let mockInstance: {
    instanceTokens: {
      validKey1: {};
      validKey2: {};
    };
    validKey1: {
      [GET_CON]: Function;
      [ALS]: AsyncLocalStorage<ALSType>;
    };
    validKey2: {
      [GET_CON]: Function;
      [ALS]: AsyncLocalStorage<ALSType>;
    };
  };
  let Instance: any;
  let that: {};
  let mockTarget: jest.Mock<any>;
  let mockPropertyDescriptor: {
    value: jest.Mock<any>;
  };
  let Transaction: ReturnType<typeof createTransaction>;

  beforeEach(() => {
    mockInstance = {
      instanceTokens: {
        validKey1: {},
        validKey2: {}
      },
      validKey1: {
        [GET_CON]: jest.fn(() =>
          Promise.resolve({
            run: jest.fn(),
            disconnectSync: jest.fn()
          })
        ),
        //@ts-ignore
        [ALS]: {
          run: jest.fn((store, callback) => callback())
        }
      },
      validKey2: {
        [GET_CON]: jest.fn(() =>
          Promise.resolve({
            run: jest.fn(),
            disconnectSync: jest.fn()
          })
        ),
        //@ts-ignore
        [ALS]: {
          run: jest.fn((store, callback) => callback())
        }
      }
    };

    Instance = jest.fn(() => mockInstance);
    Transaction = createTransaction(Instance);

    that = new Proxy(
      {},
      {
        get(target, prop) {
          if (typeof prop === 'symbol') {
            return mockInstance;
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

  it('should call Inject and inject Instance', () => {
    const mockInjectFunction = jest.fn();
    jest.mocked(Inject).mockReturnValue(mockInjectFunction);

    const Transaction = createTransaction(Instance);
    const decorator = Transaction();

    const propertyDescriptor = decorator(mockTarget, 'mockMethod', mockPropertyDescriptor);

    expect(Inject).toHaveBeenCalledWith(Instance);

    expect(mockInjectFunction).toHaveBeenCalledWith(mockTarget, expect.any(Symbol));
  });

  it('shoud set transaction matadata', () => {
    const Transaction = createTransaction(Instance);

    const decorator = Transaction();

    const originMethod = mockPropertyDescriptor.value;
    const propertyDescriptor = decorator(mockTarget, 'mockMethod', mockPropertyDescriptor);

    expect(getTransactionMetdata).toHaveBeenCalledTimes(1);
    expect(getTransactionMetdata).toHaveBeenCalledWith(originMethod);

    expect(setTransactionMetdata).toHaveBeenCalledTimes(1);
    expect(setTransactionMetdata).toHaveBeenCalledWith(originMethod);
  });

  it('shoud throw error if reapply multiple times', () => {
    const Transaction = createTransaction(Instance);

    const decorator = Transaction();

    const propertyDescriptor = decorator(mockTarget, 'mockMethod', mockPropertyDescriptor);

    expect(() => decorator(mockTarget, 'mockMethod', propertyDescriptor)).toThrow(
      'Cannot reapply the same transaction decorator multiple times.'
    );

    expect(getTransactionMetdata).toHaveBeenCalledTimes(2);
  });

  it('should call copyMethodMetadata', () => {
    const Transaction = createTransaction(Instance);

    const decorator = Transaction();

    const originMethod = mockPropertyDescriptor.value;
    const propertyDescriptor = decorator(mockTarget, 'mockMethod', mockPropertyDescriptor);

    expect(copyMethodMetadata).toHaveBeenCalledWith(originMethod, propertyDescriptor.value);
  });

  it('should override method', () => {
    const Transaction = createTransaction(Instance);

    const decorator = Transaction();

    const originMethod = mockPropertyDescriptor.value;
    const propertyDescriptor = decorator(mockTarget, 'mockMethod', mockPropertyDescriptor);

    expect(propertyDescriptor.value).not.toBe(originMethod);
  });

  it('should apply transaction to all Instance instances by default', async () => {
    const decorator = Transaction();
    const propertyDescriptor = decorator(mockTarget, 'mockMethod', mockPropertyDescriptor);

    await propertyDescriptor.value.bind(that)();

    expect(normalizeStrings).toHaveBeenCalledWith(Object.keys(mockInstance.instanceTokens));
  });

  it('should apply transaction to specified Instance instances if name was provided', async () => {
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
    const mockCon = {
      run: jest.fn(),
      disconnectSync: jest.fn()
    };

    mockPropertyDescriptor.value.mockResolvedValue('result');
    mockInstance.validKey1[GET_CON] = jest.fn(() => Promise.resolve(mockCon));

    const decorator = Transaction('validKey1');
    const propertyDescriptor = decorator(mockTarget, 'mockMethod', mockPropertyDescriptor);

    const result = await propertyDescriptor.value.bind(that)();

    expect(plainPromise).toHaveBeenCalledTimes(3);
    expect(mockCon.run).toHaveBeenCalledWith('BEGIN TRANSACTION;');
    expect(mockCon.run).toHaveBeenCalledWith('COMMIT;');
    expect(mockCon.disconnectSync).toHaveBeenCalled();
    expect(result).toBe('result');
  });

  it('should rollback transaction on error', async () => {
    const mockCon = {
      run: jest.fn(),
      disconnectSync: jest.fn()
    };

    const err = new Error('Query error');
    mockPropertyDescriptor.value.mockRejectedValue(err);
    mockInstance.validKey1[GET_CON] = jest.fn(() => Promise.resolve(mockCon));

    const decorator = Transaction('validKey1');
    const propertyDescriptor = decorator(mockTarget, 'mockMethod', mockPropertyDescriptor);

    await expect(propertyDescriptor.value.bind(that)()).rejects.toThrow(err);

    expect(plainPromise).toHaveBeenCalledTimes(3);
    expect(mockCon.run).toHaveBeenCalledWith('BEGIN TRANSACTION;');
    expect(mockCon.run).toHaveBeenCalledWith('ROLLBACK;');
    expect(mockCon.disconnectSync).toHaveBeenCalled();
  });

  it('should handle nested ALS transactions', async () => {
    const mockCon1 = {
      run: jest.fn(),
      disconnectSync: jest.fn()
    };
    const mockCon2 = {
      run: jest.fn(),
      disconnectSync: jest.fn()
    };

    mockPropertyDescriptor.value.mockResolvedValue('nestedResult');
    mockInstance.validKey1[GET_CON] = jest.fn(() => Promise.resolve(mockCon1));
    mockInstance.validKey2[GET_CON] = jest.fn(() => Promise.resolve(mockCon2));

    const decorator = Transaction();
    const propertyDescriptor = decorator(mockTarget, 'mockMethod', mockPropertyDescriptor);

    const result = await propertyDescriptor.value.bind(that)();

    expect(result).toBe('nestedResult');
    expect(mockInstance.validKey1[ALS].run).toHaveBeenCalled();
    expect(mockInstance.validKey2[ALS].run).toHaveBeenCalled();
  });

  it('should release other connected clients if failed to connect clients', async () => {
    const mockCon1 = {
      run: jest.fn(),
      disconnectSync: jest.fn()
    };
    const mockCon2 = {
      run: jest.fn(),
      disconnectSync: jest.fn()
    };

    const err = new Error('query error');
    mockPropertyDescriptor.value.mockResolvedValue('nestedResult');
    mockInstance.validKey1[GET_CON] = jest.fn(() => Promise.resolve(mockCon1));
    mockInstance.validKey2[GET_CON] = jest.fn(() => Promise.reject(err));

    const decorator = Transaction();
    const propertyDescriptor = decorator(mockTarget, 'mockMethod', mockPropertyDescriptor);

    await expect(propertyDescriptor.value.bind(that)()).rejects.toThrow(err);

    expect(mockInstance.validKey1[ALS].run).not.toHaveBeenCalled();
    expect(mockInstance.validKey2[ALS].run).not.toHaveBeenCalled();

    expect(mockCon1.disconnectSync).toHaveBeenCalled();
    expect(mockCon2.disconnectSync).not.toHaveBeenCalled();
  });

  it('should also handle catched query error correctly', async () => {
    const mockCon1 = {
      run: jest.fn(),
      disconnectSync: jest.fn()
    };
    const mockCon2 = {
      run: jest.fn(),
      disconnectSync: jest.fn()
    };

    const err = new Error('query error');
    mockPropertyDescriptor.value.mockResolvedValue('nestedResult');
    jest.mocked(mockInstance.validKey1[ALS].run).mockImplementation((store, cb) => {
      store.queries.push(Promise.resolve(err));
      return cb();
    });
    mockInstance.validKey1[GET_CON] = jest.fn(() => Promise.resolve(mockCon1));
    mockInstance.validKey2[GET_CON] = jest.fn(() => Promise.resolve(mockCon2));

    const decorator = Transaction();
    const propertyDescriptor = decorator(mockTarget, 'mockMethod', mockPropertyDescriptor);

    await expect(propertyDescriptor.value.bind(that)()).rejects.toThrow(err);

    expect(mockInstance.validKey1[ALS].run).toHaveBeenCalled();
    expect(mockInstance.validKey2[ALS].run).toHaveBeenCalled();

    expect(mockCon1.run).toHaveBeenCalledWith('BEGIN TRANSACTION;');
    expect(mockCon1.run).toHaveBeenCalledWith('ROLLBACK;');
    expect(mockCon1.disconnectSync).toHaveBeenCalled();
    expect(mockCon2.run).toHaveBeenCalledWith('BEGIN TRANSACTION;');
    expect(mockCon2.run).toHaveBeenCalledWith('ROLLBACK;');
    expect(mockCon2.disconnectSync).toHaveBeenCalled();
  });
});
