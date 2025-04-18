import {
  type DuckDBAppender,
  type DuckDBConnection,
  DuckDBInstance as DuckDBInstanceClass,
  type DuckDBMaterializedResult,
  type DuckDBResult
} from '@duckdb/node-api';
import type { DuckDBResultReader } from '@duckdb/node-api/lib/DuckDBResultReader';
import { ConnextionInstance } from '@nestjs-kitchen/connextion';
import { Logger } from '@nestjs/common';
import { CONNEXTION_DUCKDB_DEBUG, DuckDBResultAsyncMethods, DuckDBResultReaderAsyncMethods } from './constants';
import { DuckDBError } from './errors';
import type { DuckDBInstanceOptions } from './types';
import { createDebugLogger, createProxy, noop, removeEmptyValue } from './utils';

export class DuckDBInstance extends ConnextionInstance<DuckDBInstanceOptions> {
  private instance: DuckDBInstanceClass | undefined = undefined;
  private logger: Logger;
  private debugLogger: ReturnType<typeof createDebugLogger>;

  constructor(name: string, options?: DuckDBInstanceOptions) {
    super(name, options);
    this.logger = new Logger(`DuckDB][${name}`);
    const debug = Boolean(process.env[CONNEXTION_DUCKDB_DEBUG]) || options?.debug;
    this.debugLogger = debug ? createDebugLogger(this.logger.debug.bind(this.logger), debug) : noop;
  }

  async create(options: DuckDBInstanceOptions) {
    const { path, debug, ...rest } = options;

    const createOpts = removeEmptyValue(rest as { [x: string]: string });

    try {
      this.instance = await DuckDBInstanceClass.create(path, createOpts);
    } catch (error) {
      this.logger.error(error.message);
    }
  }

  dispose() {}

  private async inner<T extends (...params: any[]) => any>(
    fun: string,
    ...params: Parameters<T>
  ): Promise<ReturnType<T>> {
    if (!this.instance) {
      throw new DuckDBError('instance not found');
    }

    try {
      const con = await this.instance.connect();
      this.debugLogger({
        Type: fun,
        SQL: params[0],
        VALUES: params[1],
        TYPES: params[1]
      });
      return await con[fun](...params);
    } catch (error) {
      throw new DuckDBError(error, error);
    }
  }

  async run(...params: Parameters<DuckDBConnection['run']>) {
    const res = await this.inner<DuckDBConnection['run']>('run', ...params);
    return createProxy(res, DuckDBResultAsyncMethods);
  }

  async runAndRead(...params: Parameters<DuckDBConnection['runAndRead']>) {
    const res = await this.inner<DuckDBConnection['runAndRead']>('runAndRead', ...params);
    return createProxy(res, DuckDBResultReaderAsyncMethods);
  }

  async stream(...params: Parameters<DuckDBConnection['stream']>) {
    const res = await this.inner<DuckDBConnection['stream']>('stream', ...params);
    return createProxy(res, DuckDBResultAsyncMethods);
  }

  async streamAndRead(...params: Parameters<DuckDBConnection['streamAndRead']>) {
    const res = await this.inner<DuckDBConnection['streamAndRead']>('streamAndRead', ...params);
    return createProxy(res, DuckDBResultReaderAsyncMethods);
  }

  async createAppender(...params: Parameters<DuckDBConnection['createAppender']>) {
    if (!this.instance) {
      throw new DuckDBError('instance not found');
    }

    try {
      const con = await this.instance.connect();
      this.debugLogger({
        Type: 'createAppender',
        SQL: params[0],
        VALUES: params[1],
        TYPES: params[1]
      });
      const res = await con.createAppender(...params);
      return createProxy(res);
    } catch (error) {
      throw new DuckDBError(error, error);
    }
  }
}
