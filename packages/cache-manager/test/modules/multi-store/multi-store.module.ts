import KeyvRedis from '@keyv/redis';
import { Module } from '@nestjs/common';
import { CacheableMemory } from 'cacheable';
import { Keyv } from 'keyv';
import { CacheModule } from '../../../src';
import { MultiStoreController } from './multi-store.controller';

@Module({
  imports: [
    CacheModule.registerAsync({
      useFactory: async () => {
        return {
          stores: [
            new Keyv({ store: new CacheableMemory({ ttl: 60000, lruSize: 5000 }) }),
            new KeyvRedis('redis://localhost:6379')
          ]
        };
      }
    })
  ],
  controllers: [MultiStoreController]
})
export class MultiStoreModule {}
