import { defineConnextionBuilder } from '@nestjs-kitchen/connextion';
import { DEFAULT_INSTANCE_NAME } from './constants';
import { definePostgres } from './define-postgres';
import { PostgresInstance } from './postgres.instance';
import { createTransaction } from './transaction';

jest.mock('@nestjs-kitchen/connextion', () => {
  const actual = jest.requireActual('@nestjs-kitchen/connextion');
  return {
    ...actual,
    defineConnextionBuilder: jest.fn(actual.defineConnextionBuilder)
  };
});

jest.mock('./transaction', () => {
  const actual = jest.requireActual('./transaction');
  return {
    ...actual,
    createTransaction: jest.fn(actual.createTransaction)
  };
});

describe('definePostgres', () => {
  it('should call defineConnextionBuilder with correct arguments', () => {
    expect(defineConnextionBuilder).toHaveBeenCalledTimes(1);
    expect(defineConnextionBuilder).toHaveBeenCalledWith({
      connextionName: 'Postgres',
      InstanceClass: PostgresInstance,
      defaultInstanceName: DEFAULT_INSTANCE_NAME
    });
  });

  it('should export definePostgres', () => {
    expect(typeof definePostgres).toBe('function');
  });

  it('should return the correct structure', () => {
    const result = definePostgres();

    expect(result).toHaveProperty('Postgres', expect.any(Function));
    expect(result).toHaveProperty('PostgresModule', expect.any(Function));

    expect(createTransaction).toHaveBeenCalledTimes(1);
    expect(createTransaction).toHaveBeenCalledWith(expect.any(Function));
    expect(result).toHaveProperty('Transaction', jest.mocked(createTransaction).mock.results[0].value);
  });
});
