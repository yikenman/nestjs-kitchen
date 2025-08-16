import { AsyncLocalStorage } from 'node:async_hooks';
import { type EventEmitter } from 'node:events';
import { Logger } from '@nestjs/common';
import { ConnextionInstance } from '@nestjs-kitchen/connextion';
import {
  Pool,
  type PoolClient,
  type QueryArrayConfig,
  type QueryArrayResult,
  type QueryConfig,
  type QueryConfigValues,
  type QueryResult,
  type QueryResultRow,
  type Submittable
} from 'pg';
import { uid } from 'uid';
import { ALS, CONNEXTION_POSTGRES_DEBUG, GET_CLIENT } from './constants';
import { PostgresError } from './errors';
import type { ALSQueryType, ALSType, Options, PostgresInstanceOptions } from './types';
import {
  createDebugLogger,
  debugFactroy,
  isFailoverRequired,
  isSubmittable,
  normalizeOptions,
  plainPromise
} from './utils';

export class PostgresInstance extends ConnextionInstance<PostgresInstanceOptions> {
  private pools: Pool[] = [];
  private logger: Logger;
  private optionsArray: ReturnType<typeof normalizeOptions> = [];

  // Every instance should have its own als to avoid accessing wrong context.
  public [ALS] = new AsyncLocalStorage<ALSType>();

  private listener1: Parameters<Pool['on']>[1] = (_cli) => {
    _cli.on('error', this.listener2);
  };
  private listener2: (err: any) => void = (err) => {
    this.logger.error(err);
  };

  constructor(name: string, options?: PostgresInstanceOptions) {
    super(name, options);
    this.logger = new Logger(`Postgres][${name}`);
  }

  private async end(pool?: Pool) {
    if (!pool || pool.ending) {
      return;
    }

    try {
      await pool.end();
      pool.off('connect', this.listener1);
      pool.off('error', this.listener2);
    } catch (error) {
      this.logger.error(error);
    }
  }

  async dispose() {
    if (!this.pools) {
      return;
    }
    const pools = this.pools;
    this.pools = [];

    for (const pool of pools) {
      await this.end(pool);
    }

    return;
  }

  createPool(options: Options) {
    try {
      const pool = new Pool(options);
      //https://github.com/brianc/node-postgres/issues/2439#issuecomment-757691278
      pool.on('connect', this.listener1);
      pool.on('error', this.listener2);

      return pool;
    } catch (error) {
      this.logger.error(error.message);
    }
  }

  async create(options: PostgresInstanceOptions) {
    await this.dispose();

    this.optionsArray = normalizeOptions(options);

    if (!this.optionsArray.length) {
      throw new Error('cannot find available options');
    }

    this.pools = this.optionsArray.map((options) => this.createPool(options)).filter(Boolean) as Pool[];
  }

  private async getAndTestClient(promise: Promise<PoolClient>) {
    const client = await promise;

    if (!client) {
      return client;
    }

    try {
      // test if current client is still alive.
      await client.query('SELECT 1;');
      return client;
    } catch (error) {
      client.release(error);
      throw error;
    }
  }

  public async [GET_CLIENT]() {
    let error: any = 'failed to get client';

    for (let i = 0; i < this.optionsArray.length; i++) {
      const pool = this.pools[i];
      const debugMode = this.optionsArray[i].debug || !!process.env[CONNEXTION_POSTGRES_DEBUG];

      if (!debugMode) {
        const [client, err] = await plainPromise(this.getAndTestClient(pool.connect()));

        if (client) {
          return client;
        }

        error = err || 'client not found';

        if (!isFailoverRequired(error)) {
          break;
        }
      } else {
        // Debug mode
        const logger = createDebugLogger(this.logger.debug.bind(this.logger), debugMode);
        const debug = debugFactroy(
          this.name,
          uid(21),
          `${this.optionsArray[i].host}:${this.optionsArray[i].port}`,
          logger
        );
        const [client, err] = await plainPromise(this.getAndTestClient(debug.pool.connect(pool.connect.bind(pool))()));

        if (client) {
          return new Proxy(client, {
            get(target, prop: string, receiver) {
              const value = Reflect.get(target, prop, receiver);
              if (debug.client[prop]) {
                return debug.client[prop](value.bind(target));
              }

              return value;
            }
          });
        }

        error = err || 'client not found';

        if (!isFailoverRequired(error)) {
          break;
        }
      }
    }

    throw new PostgresError(error, typeof error === 'string' ? undefined : error);
  }

  async query<T extends Submittable>(queryStream: T): Promise<T>;
  async query<R extends any[] = any[], I = any[]>(
    queryConfig: QueryArrayConfig<I>,
    values?: QueryConfigValues<I>
  ): Promise<QueryArrayResult<R>>;
  async query<R extends QueryResultRow = any, I = any[]>(queryConfig: QueryConfig<I>): Promise<QueryResult<R>>;
  async query<R extends QueryResultRow = any, I = any[]>(
    queryTextOrConfig: string | QueryConfig<I>,
    values?: QueryConfigValues<I>
  ): Promise<QueryResult<R>>;
  async query(...rest: any[]) {
    if (!rest.length) {
      throw new PostgresError(`empty parameters`);
    }

    const store = this[ALS].getStore();

    const methodMap = {
      submittable: store ? this.transactionQueryWithSubmittable : this.queryWithSubmittable,
      config: store ? this.transactionQueryWithConfig : this.queryWithConfig
    };

    const method = methodMap[isSubmittable(rest[0]) ? 'submittable' : 'config'].bind(this);
    return method(...(rest as Parameters<typeof method>));
  }

  private async queryWithConfig<R extends any[] = any[], I = any[]>(
    queryConfig: QueryArrayConfig<I>,
    values?: QueryConfigValues<I>
  ): Promise<QueryArrayResult<R>>;
  private async queryWithConfig<R extends QueryResultRow = any, I = any[]>(
    queryConfig: QueryConfig<I>
  ): Promise<QueryResult<R>>;
  private async queryWithConfig<R extends QueryResultRow = any, I = any[]>(
    queryTextOrConfig: string | QueryConfig<I>,
    values?: QueryConfigValues<I>
  ): Promise<QueryResult<R>>;
  private async queryWithConfig(...rest: any[]) {
    const client: PoolClient = await this[GET_CLIENT]();
    let err: Error | undefined = undefined;

    try {
      return (await client.query(...(rest as Parameters<typeof client.query>))) as unknown;
    } catch (error) {
      err = new PostgresError(error, error);
      throw err;
    } finally {
      client.release(err);
    }
  }

  private async transactionQueryWithConfig<R extends any[] = any[], I = any[]>(
    queryConfig: QueryArrayConfig<I>,
    values?: QueryConfigValues<I>
  ): Promise<QueryArrayResult<R>>;
  private async transactionQueryWithConfig<R extends QueryResultRow = any, I = any[]>(
    queryConfig: QueryConfig<I>
  ): Promise<QueryResult<R>>;
  private async transactionQueryWithConfig<R extends QueryResultRow = any, I = any[]>(
    queryTextOrConfig: string | QueryConfig<I>,
    values?: QueryConfigValues<I>
  ): Promise<QueryResult<R>>;
  private async transactionQueryWithConfig(...rest: any[]) {
    const store = this[ALS].getStore()!;
    const client = await store.client;
    let err: Error | undefined = undefined;

    const { promise, resolve } = Promise.withResolvers<ALSQueryType>();
    store.queries.push(promise);
    try {
      return (await client.query(...(rest as Parameters<typeof client.query>))) as unknown;
    } catch (error) {
      err = new PostgresError(error, error);
      throw err;
    } finally {
      resolve(err ?? true);
    }
  }

  private async queryWithSubmittable<T extends Submittable>(queryStream: T): Promise<T> {
    const client = await this[GET_CLIENT]();
    let res: EventEmitter | undefined = undefined;
    let err: Error | undefined = undefined;

    try {
      res = (await client.query(queryStream)) as any;
      return res as any;
    } catch (error) {
      err = new PostgresError(error, error);
      throw err;
    } finally {
      if (res) {
        const onError = (error: Error) => {
          res!.off('end', onEnd);
          client.release(new PostgresError(error, error));
        };

        const onEnd = () => {
          res!.off('error', onError);
          client.release();
        };

        res.once('end', onEnd);
        res.once('error', onError);
      } else {
        client.release(err);
      }
    }
  }

  private async transactionQueryWithSubmittable<T extends Submittable>(queryStream: T): Promise<T> {
    const store = this[ALS].getStore()!;
    const client = await store.client;
    let res: EventEmitter | undefined = undefined;
    let err: Error | undefined = undefined;

    const { promise, resolve } = Promise.withResolvers<ALSQueryType>();
    store.queries.push(promise);

    try {
      res = (await client.query(queryStream)) as any;
      return res as any;
    } catch (error) {
      err = new PostgresError(error, error);
      throw err;
    } finally {
      if (res) {
        const onError = (error: Error) => {
          res!.off('end', onEnd);
          resolve(new PostgresError(error, error));
        };

        const onEnd = () => {
          res!.off('error', onError);
          resolve(true);
        };

        res!.once('end', onEnd);
        res!.once('error', onError);
      } else {
        resolve(err ?? true);
      }
    }
  }
}
