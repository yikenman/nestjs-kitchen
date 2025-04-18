import {
  type AsyncModuleOptions,
  type ConnectionOptionName,
  type ConnextionInstance,
  type ModuleOptions,
  defineConnextionBuilder
} from '@nestjs-kitchen/connextion';
import type { DynamicModule, Type } from '@nestjs/common';
import { DEFAULT_INSTANCE_NAME } from './constants';
import { PostgresInstance } from './postgres.instance';
import { createTransaction } from './transaction';
import type { PostgresInstanceOptions } from './types';

const innerDefinePostgres = defineConnextionBuilder({
  connextionName: 'Postgres',
  InstanceClass: PostgresInstance,
  defaultInstanceName: DEFAULT_INSTANCE_NAME
});

/**
 * Creates a set of Postgres services, modules, and their associated Transaction decorator.
 */
export const definePostgres = <T extends string = typeof DEFAULT_INSTANCE_NAME>() => {
  const { Postgres, PostgresModule } = innerDefinePostgres<T>();

  return {
    /**
     * The Postgres service, responsible for managing all postgres connection instances registered by the module.
     */
    Postgres,
    /**
     * The Postgres module, used to register and create postgres connection instances with options.
     *
     * This module can be configured using 2 static methods:
     *
     * - `register`
     * - `registerAsync`
     *
     */
    PostgresModule,
    /**
     * A decorator that automatically enables transactions for the specific Postgres
     * service instances associated with the decorated method.
     *
     * - By default, transactions are enabled for all instances of the associated Postgres service.
     * - If specific instances are specified, only those instances will have transactions enabled.
     */
    Transaction: createTransaction<T>(Postgres)
  };
};
