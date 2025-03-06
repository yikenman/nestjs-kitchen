import { defineConnextionBuilder } from '@nestjs-kitchen/connextion';
import { DEFAULT_INSTANCE_NAME } from './constants';
import { DuckDBInstance } from './duckdb.instance';

const innerDefineDuckDB = defineConnextionBuilder({
  connextionName: 'DuckDB',
  InstanceClass: DuckDBInstance,
  defaultInstanceName: DEFAULT_INSTANCE_NAME
});

/**
 * Creates a set of DuckDB services and modules.
 */
export const defineDuckDB = <T extends string = typeof DEFAULT_INSTANCE_NAME>() => {
  const { DuckDB, DuckDBModule } = innerDefineDuckDB<T>();

  return {
    /**
     * The DuckDB service, responsible for managing all DuckDB connection instances registered by the module.
     */
    DuckDB,
    /**
     * The DuckDB module, used to register and create DuckDB connection instances with options.
     *
     * This module can be configured using 2 static methods:
     *
     * - `register`
     * - `registerAsync`
     *
     */
    DuckDBModule
  };
};
