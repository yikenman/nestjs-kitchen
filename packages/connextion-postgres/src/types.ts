import type { PoolClient, PoolConfig } from 'pg';

export type ALSQueryType = Error | true;

export interface ALSType {
  client: Promise<PoolClient>;
  queries: Promise<ALSQueryType>[];
}

export type Options = PoolConfig & { debug?: boolean | ((data: Record<any, any>) => void) } & {
  /**
   * Enable multi host connections for `High Availability` (HA).
   *
   *  This will find and switch to connect the availabe host.
   *
   * If provided, will ignore `Options.host` and `Options.port`
   */
  hosts?: {
    host: PoolConfig['host'];
    port: PoolConfig['port'];
  }[];
};

export type PostgresInstanceOptions = Options;
