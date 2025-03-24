import { Module } from '@nestjs/common';
import { CacheModule } from '../../../src';
import { CacheResultTTLController } from './cache-result-ttl.controller';

@Module({
  imports: [CacheModule.register()],
  controllers: [CacheResultTTLController]
})
export class CacheResultTTLModule {}
