import { Controller, Get, Inject } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '../../../src';

@Controller()
export class DefaultTtlController {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  @Get()
  async getFromStore(): Promise<unknown> {
    const value = await this.cacheManager.get('key');
    if (!value) {
      await this.cacheManager.set('key', 'value');
    }
    return value ?? 'Not found';
  }
}
