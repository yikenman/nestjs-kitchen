import { Module } from '@nestjs/common';
import { PROXY_OPTIONS } from './constant';
import { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } from './module-builder';
import type { ProxyModuleOptions } from './types';

/**
 * Provides default values for options. When creating a proxy instance, the options
 * are merged in order: module-level, controller-level, then handler-level.
 *
 * **Note: The merge is shallow; nested objects are not merged recursively.**
 */
@Module({
  providers: [
    {
      provide: PROXY_OPTIONS,
      useFactory: (moduleOptions: ProxyModuleOptions) => {
        return moduleOptions.options;
      },
      inject: [MODULE_OPTIONS_TOKEN]
    }
  ],
  exports: [PROXY_OPTIONS]
})
export class ProxyModule extends ConfigurableModuleClass {}
