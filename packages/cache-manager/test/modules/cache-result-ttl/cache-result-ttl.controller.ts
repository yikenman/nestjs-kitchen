import { Controller, Get } from '@nestjs/common';
import { CacheResult, CacheTTL } from '../../../src';

@Controller()
@CacheTTL(600)
export class CacheResultTTLController {
  counter = 0;
  constructor() {}

  @Get()
  getNumber() {
    return this.getNumberWithCacheTTL();
  }

  @CacheTTL(500)
  @CacheResult()
  getNumberWithCacheTTL() {
    return this.counter++;
  }

  @Get('/controller')
  getNumberWithControllerTTL() {
    return this.getNumberWithoutCacheTTL();
  }

  @CacheResult()
  getNumberWithoutCacheTTL() {
    return this.counter++;
  }
}
