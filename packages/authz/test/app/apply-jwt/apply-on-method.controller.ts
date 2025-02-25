import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthzGuard1, JwtAuthzService1 } from '../jwt.module';

@Controller('apply-on-method')
export class ApplyOnMethodController {
  constructor(private readonly service: JwtAuthzService1) {}

  @Get('log-in')
  async logIn(@Query('userId') userId: string) {
    const result = await this.service.logIn({
      userId1: userId
    });

    return result;
  }

  @UseGuards(JwtAuthzGuard1)
  @Get('get-user')
  async getUser() {
    const user = await this.service.getUser();

    return user;
  }
}
