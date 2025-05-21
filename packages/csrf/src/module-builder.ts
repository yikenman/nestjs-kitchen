import {
  type ConfigurableModuleAsyncOptions,
  ConfigurableModuleBuilder,
  type ConfigurableModuleCls
} from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { CsrfGuard } from './csrf.guard';
import { CsrfInterceptor } from './csrf.interceptor';
import type { CsrfModuleOptions } from './types';

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, ASYNC_OPTIONS_TYPE, OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<CsrfModuleOptions>({
    moduleName: 'CsrfModule'
  })
    .setFactoryMethodName('createModuleOptions')
    .setExtras<{
      /**
       * If set to true, `CsrfGuard` and `CsrfInterceptor` will be applied globally.
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
                  provide: APP_GUARD,
                  useClass: CsrfGuard
                },
                {
                  provide: APP_INTERCEPTOR,
                  useClass: CsrfInterceptor
                }
              ]
            : [])
        ]
      })
    )
    .build();
