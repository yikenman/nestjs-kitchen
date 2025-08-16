import { Logger } from '@nestjs/common';
import { ConnextionInstance } from '@nestjs-kitchen/connextion';
import { Client, type Column, type RuntimeStats } from 'presto-client';
import { CONNEXTION_PRESTO_DEBUG } from './constants';
import { PrestoError } from './errors';
import type { ExecuteOptions, PrestoInstanceOptions, QueryResult, QueryResultRow } from './types';
import { buildDataRows, createDebugLogger, getCurrentDateStr, noop } from './utils';

const END_STATE_LIST = ['FINISHED', 'CANCELED', 'FAILED'];

export class PrestoInstance extends ConnextionInstance<PrestoInstanceOptions> {
  private client: Client | undefined = undefined;
  private queryIdMap: Map<string, RuntimeStats['state']> = new Map();
  private logger: Logger;
  private debugLogger: ReturnType<typeof createDebugLogger>;

  constructor(name: string, options?: PrestoInstanceOptions) {
    super(name, options);
    this.logger = new Logger(`Presto][${name}`);
    const debug = Boolean(process.env[CONNEXTION_PRESTO_DEBUG]) || options?.debug;
    this.debugLogger = debug ? createDebugLogger(this.logger.debug.bind(this.logger), debug) : noop;
  }

  private end(client?: Client, queryIdMap?: typeof this.queryIdMap) {
    if (!client || !queryIdMap || !queryIdMap.size) {
      return;
    }

    const queryIds = [...queryIdMap.entries()].filter(([_, stat]) => !END_STATE_LIST.includes(stat)).map(([id]) => id);
    if (!queryIds.length) {
      return;
    }

    return Promise.allSettled(
      queryIds.map((id) => {
        const { promise, reject, resolve } = Promise.withResolvers<void>();
        const startOn = getCurrentDateStr();
        client.kill(id, (err) => {
          this.debugLogger({
            Instance: this.name,
            QueryId: id,
            Type: 'Kill',
            'Started On': startOn,
            'Ended On': getCurrentDateStr(),
            Status: err ? 'Failed' : 'Successful',
            Error: err
          });
          this.logger.error(err);
          return err ? reject(err) : resolve();
        });

        return promise;
      })
    );
  }

  dispose() {
    if (!this.client) {
      return;
    }

    const queryIdMap = this.queryIdMap;
    const client = this.client;
    this.queryIdMap = new Map();
    this.client = undefined;

    return this.end(client, queryIdMap);
  }

  create(options: PrestoInstanceOptions) {
    this.dispose();
    options.user = options.user ?? options.basic_auth?.user;
    try {
      this.client = new Client(options);
    } catch (error) {
      this.logger.error(error.message);
    }
  }

  execute<T extends QueryResultRow = any>(options: ExecuteOptions) {
    const { promise, reject, resolve } = Promise.withResolvers<QueryResult<T>>();

    if (!this.client) {
      reject(new PrestoError('client not found.'));
      return promise;
    }

    const columns: Column[] = [];
    const rawData: unknown[][] = [];
    const startOn = getCurrentDateStr();
    let queryId: string = '';

    this.client.execute({
      ...options,
      state: (_, query_id, stats) => {
        queryId = query_id;
        if (END_STATE_LIST.includes(stats.state)) {
          this.queryIdMap.delete(query_id);
        } else {
          this.queryIdMap.set(query_id, stats.state);
        }
      },
      columns: (_, data) => {
        columns.push(...data);
      },
      data: (_, data) => {
        rawData.push(...data);
      },
      error: (error) => {
        this.debugLogger({
          Instance: this.name,
          QueryId: queryId,
          Type: 'Query',
          SQL: options.query,
          'Started On': startOn,
          'Ended On': getCurrentDateStr(),
          Status: 'Failed',
          Error: error
        });
        reject(new PrestoError(error.message, error));
      },
      success: () => {
        const rows = buildDataRows<T>(columns, rawData);
        this.debugLogger({
          Instance: this.name,
          QueryId: queryId,
          Type: 'Query',
          SQL: options.query,
          'Started On': startOn,
          'Ended On': getCurrentDateStr(),
          Status: 'Successful'
        });
        resolve({
          columns,
          rows,
          rowCount: rows.length,
          queryId
        });
      }
    });

    return promise;
  }
}
