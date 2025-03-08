import { Controller, Get, Inject } from '@nestjs/common';
import { Cache } from '../../../src';
import { CACHE_MANAGER } from '../../../src';

@Controller()
export class AsyncRegisterController {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  @Get()
  async getFromStore(): Promise<string> {
    const value: string | undefined | null = await this.cacheManager.get('key');
    if (!value) {
      await this.cacheManager.set('key', 'value');
    }
    return value ?? 'Not found';
  }
}
