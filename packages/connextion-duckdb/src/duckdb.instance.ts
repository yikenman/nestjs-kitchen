import {
  type DuckDBAppender,
  type DuckDBConnection,
  DuckDBInstance as DuckDBInstanceClass,
  type DuckDBMaterializedResult,
  type DuckDBResult
} from '@duckdb/node-api';
import type { DuckDBResultReader } from '@duckdb/node-api/lib/DuckDBResultReader';
import { Logger } from '@nestjs/common';
import { ConnextionInstance } from '@nestjs-kitchen/connextion';
import { AsyncLocalStorage } from 'async_hooks';
import {
  ALS,
  CONNEXTION_DUCKDB_DEBUG,
  ConnectionMethods,
  DuckDBResultAsyncMethods,
  DuckDBResultReaderAsyncMethods,
  GET_CON
} from './constants';
import { DuckDBError } from './errors';
import type { ALSQueryType, ALSType, DuckDBInstanceOptions } from './types';
import { createDebugLogger, createProxy, noop, removeEmptyValue } from './utils';

export class DuckDBInstance extends ConnextionInstance<DuckDBInstanceOptions> {
  private instance: DuckDBInstanceClass | undefined = undefined;
  private logger: Logger;
  private debug: boolean;
  private debugLogger: ReturnType<typeof createDebugLogger>;

  // Every instance should have its own als to avoid accessing wrong context.
  public [ALS] = new AsyncLocalStorage<ALSType>();

  constructor(name: string, options?: DuckDBInstanceOptions) {
    super(name, options);
    this.logger = new Logger(`DuckDB][${name}`);
    this.debug = Boolean(process.env[CONNEXTION_DUCKDB_DEBUG]) || Boolean(options?.debug);
    this.debugLogger = this.debug ? createDebugLogger(this.logger.debug.bind(this.logger), this.debug) : noop;
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

  dispose() {
    if (this.instance) {
      this.instance.closeSync();
    }
  }

  public async [GET_CON]() {
    if (!this.instance) {
      throw new DuckDBError('instance not found');
    }

    const con = await this.instance.connect();

    if (this.debug) {
      return new Proxy(con, {
        get: (target, prop, receiver) => {
          const value = Reflect.get(target, prop, receiver);
          if (typeof prop === 'string' && ConnectionMethods.has(prop)) {
            return (...rest: any[]) => {
              this.debugLogger({
                NAME: this.name,
                Type: prop,
                SQL: rest[0],
                VALUES: rest[1],
                TYPES: rest[1]
              });
              return value.apply(target, rest);
            };
          }

          return value;
        }
      });
    }

    return con;
  }

  private async innerNormal<T extends (...params: any[]) => any>(
    fun: string,
    ...params: Parameters<T>
  ): Promise<ReturnType<T>> {
    if (!this.instance) {
      throw new DuckDBError('instance not found');
    }

    try {
      const con = await this[GET_CON]();
      return await con[fun](...params);
    } catch (error) {
      throw new DuckDBError(error, error);
    }
  }

  private async innerTransaction<T extends (...params: any[]) => any>(
    fun: string,
    ...params: Parameters<T>
  ): Promise<ReturnType<T>> {
    const store = this[ALS].getStore()!;
    const con = await store.connection;
    let err: Error | undefined = undefined;

    const { promise, resolve } = Promise.withResolvers<ALSQueryType>();
    store.queries.push(promise);
    try {
      return await con[fun](...params);
    } catch (error) {
      err = new DuckDBError(error, error);
      throw err;
    } finally {
      resolve(err ?? true);
    }
  }

  private inner<T extends (...params: any[]) => any>(fun: string, ...params: Parameters<T>): Promise<ReturnType<T>> {
    return this[ALS].getStore() ? this.innerTransaction(fun, ...params) : this.innerNormal(fun, ...params);
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
      const res = await con.createAppender(...params);
      return createProxy(res);
    } catch (error) {
      throw new DuckDBError(error, error);
    }
  }
}
