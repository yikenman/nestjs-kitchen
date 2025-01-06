import type { PoolClient, PoolConfig } from 'pg';

export type ALSQueryType = Error | true;

export interface ALSType {
  client: Promise<PoolClient>;
  queries: Promise<ALSQueryType>[];
}

export type PostgresInstanceOptions = PoolConfig & { debug?: boolean | ((data: Record<any, any>) => void) };
