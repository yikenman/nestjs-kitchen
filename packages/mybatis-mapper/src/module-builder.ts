import {
  type ConfigurableModuleAsyncOptions,
  ConfigurableModuleBuilder,
  type ConfigurableModuleCls
} from '@nestjs/common';
import type { Format } from 'mybatis-mapper';
import type { GlobOptions } from 'tinyglobby';
import type { MybatisMapperModuleOptions } from './types';

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, ASYNC_OPTIONS_TYPE, OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<MybatisMapperModuleOptions>({
    moduleName: 'MybatisMapperModule'
  })
    .setFactoryMethodName('createModuleOptions')
    .setExtras<{
      global?: boolean;
    }>(
      {
        global: false
      },
      (definition, extras) => ({
        ...definition,
        global: extras.global
      })
    )
    .build();
