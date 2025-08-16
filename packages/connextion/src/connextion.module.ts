import { type DynamicModule, type Provider, type Type } from '@nestjs/common';
import { uid } from 'uid';
import type { ConnextionInstance } from './connextion.instance';
import { createConnextionService } from './connextion.service';
import { DEFAULT_INSTANCE_NAME, INJECT_TOKEN_ID, INSTANCE_TOKEN_MAP, PREFIX } from './constants';
import {
  type AsyncModuleOptions,
  type ConnectionOptionName,
  type ConnectionOptions,
  createAsyncProviders,
  joinStrs,
  type ModuleOptions,
  mixinModule,
  normalizeConnections
} from './utils';

export const defineConnextionBuilder = <
  CON_N extends string,
  I extends ConnextionInstance<unknown>,
  DEF_I_N extends string = typeof DEFAULT_INSTANCE_NAME,
  O = I extends ConnextionInstance<infer U> ? U : never
>(buildOptions: {
  connextionName: CON_N;
  InstanceClass: Type<I>;
  defaultInstanceName?: DEF_I_N;
}) => {
  const { InstanceClass, connextionName, defaultInstanceName = DEFAULT_INSTANCE_NAME } = buildOptions;
  const moduleName = `${connextionName}Module`;

  return <N extends string = DEF_I_N>() => {
    const Connextion = createConnextionService<N, I>();

    const obj = {
      [moduleName]: class {
        static register(options: ModuleOptions<N, O>): DynamicModule {
          const { connections, ...rest } = options;

          const injectTokenId = `${PREFIX}${uid()}`;

          const instanceProviders: Provider[] = [];
          const instanceTokenMap: Record<string, string> = {};

          normalizeConnections(connections, defaultInstanceName).forEach(([name, options]) => {
            const instanceToken = joinStrs(injectTokenId, name);

            instanceProviders.push({
              provide: instanceToken,
              useFactory: () => {
                return new InstanceClass(instanceToken, options);
              }
            });
            instanceTokenMap[name] = instanceToken;
          });

          return {
            ...rest,
            module: obj[moduleName],
            providers: [
              ...instanceProviders,
              {
                provide: INJECT_TOKEN_ID,
                useValue: injectTokenId
              },
              {
                provide: INSTANCE_TOKEN_MAP,
                useValue: Object.freeze(instanceTokenMap)
              },
              Connextion
            ],
            exports: [Connextion]
          };
        }

        static registerAsync(options: AsyncModuleOptions<N, O>): DynamicModule {
          const { connections, ...rest } = options;

          const injectTokenId = `${PREFIX}${uid()}`;

          let instanceProviders: Provider[] = [];
          const instanceTokenMap: Record<string, string> = {};

          normalizeConnections(connections, defaultInstanceName).forEach(([name, options]) => {
            const instanceToken = joinStrs(injectTokenId, name);
            const optionsToken = Symbol(joinStrs(instanceToken, 'options'));

            instanceProviders = instanceProviders.concat(createAsyncProviders(optionsToken, options));

            instanceProviders.push({
              provide: instanceToken,
              useFactory: (options: ConnectionOptions<N, O>) => {
                return new InstanceClass(instanceToken, options);
              },
              inject: [optionsToken]
            });
            instanceTokenMap[name] = instanceToken;
          });

          return {
            ...rest,
            module: obj[moduleName],
            providers: [
              ...instanceProviders,
              {
                provide: INJECT_TOKEN_ID,
                useValue: injectTokenId
              },
              {
                provide: INSTANCE_TOKEN_MAP,
                useValue: Object.freeze(instanceTokenMap)
              },
              Connextion
            ],
            exports: [Connextion]
          };
        }
      }
    };

    return {
      [moduleName]: mixinModule(obj[moduleName]),
      [connextionName]: Connextion
    } as unknown as {
      [K in `${Capitalize<CON_N>}Module`]: (typeof obj)[typeof moduleName];
    } & {
      [K in `${Capitalize<CON_N>}`]: typeof Connextion;
    };
  };
};
