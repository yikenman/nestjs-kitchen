import {
  type ConfigurableModuleAsyncOptions,
  ConfigurableModuleBuilder,
  type ConfigurableModuleCls
} from '@nestjs/common';
import type { HeadersModuleOptions } from './types';

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, ASYNC_OPTIONS_TYPE, OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<HeadersModuleOptions>({
    moduleName: 'HeadersModule'
  })
    .setFactoryMethodName('createModuleOptions')
    .build();
