import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SessionAuthzGuard3, SessionAuthzService3 } from '../session.module';

@UseGuards(SessionAuthzGuard3)
@Controller('apply-on-method')
export class ApplyOnMethodController {
  constructor(private readonly service: SessionAuthzService3) {}

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
