import { Controller, Get, Query } from '@nestjs/common';
import { SessionAuthzGuard3, SessionAuthzGuard4, SessionAuthzService3, SessionAuthzService4 } from '../session.module';

@SessionAuthzGuard3.Apply()
@Controller('session-4-under-session-3')
export class Session4UnderSession3Controller {
  constructor(
    private readonly service3: SessionAuthzService3,
    private readonly service4: SessionAuthzService4
  ) {}

  @SessionAuthzGuard3.NoVerify()
  @Get('log-in')
  async logIn(@Query('userId') userId: string) {
    const result3 = await this.service3.logIn({
      userId3: userId
    });
    const result4 = await this.service4.logIn({
      userId4: userId
    });

    return { result3, result4 };
  }

  @SessionAuthzGuard4.Apply()
  @Get('get-user')
  async getUser() {
    const user3 = await this.service3.getUser();
    const user4 = await this.service4.getUser();

    return { user3, user4 };
  }
}
