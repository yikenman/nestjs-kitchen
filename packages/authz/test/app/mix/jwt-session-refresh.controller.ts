import { Controller, Get, Query } from '@nestjs/common';
import { JwtAuthzGuard2, JwtAuthzService2 } from '../jwt.module';
import { SessionAuthzGuard3, SessionAuthzService3 } from '../session.module';

@JwtAuthzGuard2.Apply()
@Controller('jwt-session-refresh')
export class JwtSessionRefreshController {
  constructor(
    private readonly service2: JwtAuthzService2,
    private readonly service3: SessionAuthzService3
  ) {}

  @JwtAuthzGuard2.NoVerify()
  @Get('log-in')
  async logIn(@Query('userId') userId: string) {
    const result2 = await this.service2.logIn({
      userId2: userId
    });
    const result3 = await this.service3.logIn({
      userId3: userId
    });

    return { result2, result3 };
  }

  @Get('get-user')
  async getUser() {
    const user2 = await this.service2.getUser();
    const user3 = await this.service3.getUser();

    return { user2, user3 };
  }

  @JwtAuthzGuard2.NoVerify()
  @SessionAuthzGuard3.Apply()
  @Get('refresh')
  async refresh() {
    const userI3 = await this.service3.getUser();
    const result2 = await this.service2.logIn({
      userId2: userI3?.userId3!
    });

    return { result2 };
  }
}
