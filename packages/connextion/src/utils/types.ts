import type { FactoryProvider, ModuleMetadata, Type } from '@nestjs/common';

export type ConnectionOptionName<N> = N extends string ? N | (string & {}) : string;

export type ConnectionOptions<N, O> = { name?: ConnectionOptionName<N> } & O;

export type ModuleOptions<N, O> = {
  global?: boolean;
  connections: ConnectionOptions<N, O>[] | ConnectionOptions<N, O>;
};

export interface ConnectionOptionsFactory<N, O> {
  createConnectionOptions(): Promise<Omit<ConnectionOptions<N, O>, 'name'>> | Omit<ConnectionOptions<N, O>, 'name'>;
}

export type AsyncConnectionOptions<N, O> = {
  name?: N extends string ? N | (string & {}) : string;
  useExisting?: Type<ConnectionOptionsFactory<N, O>>;
  useClass?: Type<ConnectionOptionsFactory<N, O>>;
  useFactory?: (
    ...args: any[]
  ) => Promise<Omit<ConnectionOptions<N, O>, 'name'>> | Omit<ConnectionOptions<N, O>, 'name'>;
  inject?: FactoryProvider['inject'];
};

export type AsyncModuleOptions<N, O> = Pick<ModuleMetadata, 'imports'> & {
  global?: boolean;
  connections: AsyncConnectionOptions<N, O>[] | AsyncConnectionOptions<N, O>;
};

export type SetRequired<N, K extends keyof N> = N & {
  [P in K]-?: NonNullable<N[P]>;
};

export type OmitClassInstance<T extends abstract new (...args: any) => any, K extends keyof any> = Type<
  Omit<InstanceType<T>, K>
>;
