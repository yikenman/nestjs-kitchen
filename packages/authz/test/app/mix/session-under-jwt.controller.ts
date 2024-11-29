import { Controller, Get, Query } from '@nestjs/common';
import { JwtAuthzGuard1, JwtAuthzService1 } from '../jwt.module';
import { SessionAuthzGuard3, SessionAuthzService3 } from '../session.module';

@JwtAuthzGuard1.Apply()
@Controller('session-under-jwt')
export class SessionUnderJwtController {
  constructor(
    private readonly service1: JwtAuthzService1,
    private readonly service3: SessionAuthzService3
  ) {}

  @JwtAuthzGuard1.NoVerify()
  @Get('log-in')
  async logIn(@Query('userId') userId: string) {
    const result1 = await this.service1.logIn({
      userId1: userId
    });
    const result3 = await this.service3.logIn({
      userId3: userId
    });

    return { result1, result3 };
  }

  @SessionAuthzGuard3.Apply()
  @Get('get-user')
  async getUser() {
    const user1 = await this.service1.getUser();
    const user3 = await this.service3.getUser();

    return { user1, user3 };
  }
}
