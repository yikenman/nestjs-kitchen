import {
  type AsyncModuleOptions,
  type ConnectionOptionName,
  type ConnextionInstance,
  type ModuleOptions,
  defineConnextionBuilder
} from '@nestjs-kitchen/connextion';
import type { DynamicModule, Type } from '@nestjs/common';
import { DEFAULT_INSTANCE_NAME } from './constants';
import { DuckDBInstance } from './duckdb.instance';
import type { DuckDBInstanceOptions } from './types';

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
