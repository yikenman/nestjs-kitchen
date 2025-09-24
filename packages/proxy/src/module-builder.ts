import {
  type ConfigurableModuleAsyncOptions,
  ConfigurableModuleBuilder,
  type ConfigurableModuleCls
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ProxyInterceptor } from './proxy.interceptor';
import type { ProxyModuleOptions } from './types';

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, ASYNC_OPTIONS_TYPE, OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<ProxyModuleOptions>({
    moduleName: 'ProxyModule'
  })
    .setFactoryMethodName('createModuleOptions')
    .setExtras<{
      /**
       * If set to true, `ProxyInterceptor` will be applied globally.
       */
      global?: boolean;
    }>(
      {
        global: false
      },
      (definition, extras) => ({
        ...definition,
        global: extras.global,
        providers: [
          ...(definition.providers ?? []),
          ...(extras.global
            ? [
                {
                  provide: APP_INTERCEPTOR,
                  useClass: ProxyInterceptor
                }
              ]
            : [])
        ]
      })
    )
    .build();
