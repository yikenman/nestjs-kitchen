import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthzGuard1, JwtAuthzService1 } from '../jwt.module';

@UseGuards(JwtAuthzGuard1)
@JwtAuthzGuard1.Verify()
@Controller('apply-on-both')
export class ApplyOnBothController {
  constructor(private readonly service: JwtAuthzService1) {}

  @JwtAuthzGuard1.NoVerify()
  @Get('log-in')
  async logIn(@Query('userId') userId: string) {
    const result = await this.service.logIn({
      userId1: userId
    });

    return result;
  }

  @JwtAuthzGuard1.Verify()
  @Get('get-user')
  async getUser() {
    const user = await this.service.getUser();

    return user;
  }
}
