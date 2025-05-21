import { Controller, Get, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { Csrf, CsrfGuard, CsrfInterceptor } from '../src';

@UseGuards(CsrfGuard)
@UseInterceptors(CsrfInterceptor)
@Controller()
export class AppController {
  @Post('/require-csrf')
  requireCsrf() {
    return { ok: true };
  }

  @Csrf.NoVerify()
  @Post('/not-require-csrf')
  notRequireCsrf() {
    return { ok: true };
  }

  @Get('/public')
  public() {
    return { ok: true };
  }

  @Csrf()
  @Get('/not-public')
  notPublic() {
    return { ok: true };
  }

  @Csrf.Sign()
  @Get('/csrf')
  csrf() {
    return { ok: true };
  }
}
