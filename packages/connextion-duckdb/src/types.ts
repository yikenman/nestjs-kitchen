import type { DuckDBConnection } from '@duckdb/node-api';

export type DuckDBInstanceOptions = {
  path: string;
  debug?: boolean;
  [key: string]: string | boolean | undefined;
};

export type ParamsTuple = [any, any?, any?];
export type CallbackType = [callback?: () => void];
export type ExtendParams<T extends unknown[], E extends unknown[]> = [...T, ...E];

export type ALSQueryType = Error | true;

export interface ALSType {
  connection: Promise<DuckDBConnection>;
  queries: Promise<ALSQueryType>[];
}
