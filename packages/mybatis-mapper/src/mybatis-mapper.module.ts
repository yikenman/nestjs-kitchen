import { Module } from '@nestjs/common';
import { ConfigurableModuleClass } from './module-builder';
import { MybatisMapper } from './mybatis-mapper.service';

@Module({
  providers: [MybatisMapper],
  exports: [MybatisMapper]
})
export class MybatisMapperModule extends ConfigurableModuleClass {}
