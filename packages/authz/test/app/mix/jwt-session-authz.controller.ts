import { Controller, Get, Query } from '@nestjs/common';
import { JwtAuthzGuard2, JwtAuthzService2 } from '../jwt.module';
import { SessionAuthzGuard4, SessionAuthzService4 } from '../session.module';

@JwtAuthzGuard2.Apply('ROLE_ID', {
  allowAnonymous: true
})
@Controller('jwt-session-authz')
export class JwtSessionAuthzController {
  constructor(
    private readonly service2: JwtAuthzService2,
    private readonly service4: SessionAuthzService4
  ) {}

  @JwtAuthzGuard2.NoVerify()
  @Get('log-in')
  async logIn(
    @Query('userId') userId: string,
    @Query('jwtRole') jwtRole?: string,
    @Query('sessionRole') sessionRole?: string
  ) {
    const result2 = await this.service2.logIn({
      userId2: userId,
      jwtRole2: jwtRole
    });
    const result4 = await this.service4.logIn({
      userId4: userId,
      sessionRole4: sessionRole
    });

    return { result2, result4 };
  }

  @Get('get-user')
  async getUser() {
    const user2 = await this.service2.getUser();
    const user4 = await this.service4.getUser();

    return { user2, user4 };
  }

  @JwtAuthzGuard2.NoVerify()
  @SessionAuthzGuard4.Apply('ROLE_ID')
  @Get('refresh')
  async refresh() {
    const userI4 = await this.service4.getUser();
    const result2 = await this.service2.logIn({
      userId2: userI4?.userId4!,
      jwtRole2: userI4?.sessionRole4
    });

    return { result2 };
  }
}
