import { Controller, Get, Query } from '@nestjs/common';
import { JwtAuthzGuard1, JwtAuthzGuard2, JwtAuthzService1, JwtAuthzService2 } from '../jwt.module';

@JwtAuthzGuard1.Apply()
@Controller('jwt-2-under-jwt-1')
export class Jwt2UnderJwt1Controller {
  constructor(
    private readonly service1: JwtAuthzService1,
    private readonly service2: JwtAuthzService2
  ) {}

  @JwtAuthzGuard1.NoVerify()
  @Get('log-in')
  async logIn(@Query('userId') userId: string) {
    const result1 = await this.service1.logIn({
      userId1: userId
    });
    const result2 = await this.service2.logIn({
      userId2: userId
    });

    return { result1, result2 };
  }

  @JwtAuthzGuard2.Apply()
  @Get('get-user')
  async getUser() {
    const user1 = await this.service1.getUser();
    const user2 = await this.service2.getUser();

    return { user1, user2 };
  }
}
