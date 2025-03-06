import { defineConnextionBuilder } from '@nestjs-kitchen/connextion';
import { DEFAULT_INSTANCE_NAME } from './constants';
import { defineDuckDB } from './define-duckdb';
import { DuckDBInstance } from './duckdb.instance';

jest.mock('@nestjs-kitchen/connextion', () => {
  const actual = jest.requireActual('@nestjs-kitchen/connextion');
  return {
    ...actual,
    defineConnextionBuilder: jest.fn(actual.defineConnextionBuilder)
  };
});

describe('defineDuckDB', () => {
  it('should call defineConnextionBuilder with correct arguments', () => {
    expect(defineConnextionBuilder).toHaveBeenCalledTimes(1);
    expect(defineConnextionBuilder).toHaveBeenCalledWith({
      connextionName: 'DuckDB',
      InstanceClass: DuckDBInstance,
      defaultInstanceName: DEFAULT_INSTANCE_NAME
    });
  });

  it('should export defineDuckDB', () => {
    expect(typeof defineDuckDB).toBe('function');
  });

  it('should return the correct structure', () => {
    const result = defineDuckDB();

    expect(result).toHaveProperty('DuckDB', expect.any(Function));
    expect(result).toHaveProperty('DuckDBModule', expect.any(Function));
  });
});
