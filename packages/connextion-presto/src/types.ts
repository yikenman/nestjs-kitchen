import type { ClientOptions, Column, QueryOptions } from 'presto-client';

export type PrestoInstanceOptions = ClientOptions & { debug?: boolean | ((data: Record<any, any>) => void) };

export type ExecuteOptions = Omit<
  QueryOptions,
  'cancel' | 'state' | 'columns' | 'data' | 'retry' | 'success' | 'error' | 'callback'
>;

export interface QueryResultRow {
  [column: string]: any;
}

export type QueryResult<R extends QueryResultRow = any> = {
  columns: Column[];
  rows: R[];
  rowCount: number;
  queryId: string;
};
