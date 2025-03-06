import { AsyncLocalStorage } from 'node:async_hooks';
import { type EventEmitter } from 'node:events';
import { ConnextionInstance } from '@nestjs-kitchen/connextion';
import { Logger } from '@nestjs/common';
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
import type { ALSQueryType, ALSType, PostgresInstanceOptions } from './types';
import { createDebugLogger, debugFactroy, isSubmittable, plainPromise } from './utils';

export class PostgresInstance extends ConnextionInstance<PostgresInstanceOptions> {
  private pool: Pool | undefined = undefined;
  private logger: Logger;
  private debug: PostgresInstanceOptions['debug'];

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
    this.debug = Boolean(process.env[CONNEXTION_POSTGRES_DEBUG]) || options?.debug;
  }

  private async end(pool?: Pool) {
    if (!pool) {
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

  dispose() {
    if (!this.pool) {
      return;
    }
    const pool = this.pool;
    this.pool = undefined;

    return this.end(pool);
  }

  create(options: PostgresInstanceOptions) {
    this.dispose();

    try {
      const pool = new Pool(options);

      //https://github.com/brianc/node-postgres/issues/2439#issuecomment-757691278
      pool.on('connect', this.listener1);
      pool.on('error', this.listener2);

      this.pool = pool;
    } catch (error) {
      this.logger.error(error.message);
    }
  }

  public async [GET_CLIENT]() {
    if (!this.pool) {
      throw new PostgresError('pool not found');
    }

    if (!this.debug) {
      const [client, err] = await plainPromise(this.pool.connect());
      if (err) {
        throw new PostgresError(err, err);
      }
      if (!client) {
        throw new PostgresError('client not found');
      }
      return client;
    }

    // Debug mode
    const logger = createDebugLogger(this.logger.debug.bind(this.logger), this.debug);
    const debug = debugFactroy(this.name, uid(21), logger);
    const [client, err] = await plainPromise(debug.pool.connect(this.pool.connect.bind(this.pool))());
    if (err) {
      throw new PostgresError(err, err);
    }
    if (!client) {
      throw new PostgresError('client not found');
    }

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
      client.release(err ?? true);
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
          client.release(true);
        };

        res.once('end', onEnd);
        res.once('error', onError);
      } else {
        client.release(err ?? true);
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
