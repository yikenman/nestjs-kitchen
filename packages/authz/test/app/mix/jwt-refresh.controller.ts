import { Controller, Get, Query } from '@nestjs/common';
import { JwtAuthzGuard1, JwtAuthzService1 } from '../jwt.module';

@JwtAuthzGuard1.Apply()
@Controller('jwt-refresh')
export class JwtRefreshController {
  constructor(private readonly service1: JwtAuthzService1) {}

  @JwtAuthzGuard1.NoVerify()
  @Get('log-in')
  async logIn(@Query('userId') userId: string) {
    const result = await this.service1.logIn({
      userId1: userId
    });

    return result;
  }

  @Get('get-user')
  async getUser() {
    const user1 = await this.service1.getUser();

    return user1;
  }

  @JwtAuthzGuard1.Refresh()
  @Get('refresh')
  async refresh() {
    const result = await this.service1.refresh();

    return result;
  }
}
