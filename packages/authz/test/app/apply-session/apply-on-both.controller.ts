import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SessionAuthzGuard3, SessionAuthzService3 } from '../session.module';

@UseGuards(SessionAuthzGuard3)
@SessionAuthzGuard3.Verify()
@Controller('apply-on-both')
export class ApplyOnBothController {
  constructor(private readonly service: SessionAuthzService3) {}

  @SessionAuthzGuard3.NoVerify()
  @Get('log-in')
  async logIn(@Query('userId') userId: string) {
    const result = await this.service.logIn({
      userId3: userId
    });

    return result;
  }

  @SessionAuthzGuard3.Verify()
  @Get('get-user')
  async getUser() {
    const user = await this.service.getUser();

    return user;
  }
}
