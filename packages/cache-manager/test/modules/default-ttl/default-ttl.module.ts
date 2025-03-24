import { Module } from '@nestjs/common';
import { CacheModule } from '../../../src';
import { DefaultTtlController } from './default-ttl.controller';

@Module({
  imports: [CacheModule.register()],
  controllers: [DefaultTtlController]
})
export class DefaultTtlModule {}
