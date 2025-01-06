import type { Provider } from '@nestjs/common';
import type { AsyncConnectionOptions, ConnectionOptionsFactory } from './types';

export const asyncOptionsProviderFactory = (optionsFactory: ConnectionOptionsFactory<unknown, unknown>) =>
  optionsFactory.createConnectionOptions();

export const createAsyncOptionsProvider = (
  token: string | symbol,
  options: AsyncConnectionOptions<unknown, unknown>
): Provider => {
  if (options.useFactory) {
    return {
      provide: token,
      useFactory: options.useFactory,
      inject: options.inject || []
    };
  }
  return {
    provide: token,
    useFactory: asyncOptionsProviderFactory,
    inject: [options.useExisting || options.useClass!]
  };
};

export const createAsyncProviders = (
  token: string | symbol,
  options: AsyncConnectionOptions<unknown, unknown>
): Provider[] => {
  if (options.useExisting || options.useFactory) {
    return [createAsyncOptionsProvider(token, options)];
  }
  return [
    createAsyncOptionsProvider(token, options),
    {
      provide: options.useClass!,
      useClass: options.useClass!
    }
  ];
};
