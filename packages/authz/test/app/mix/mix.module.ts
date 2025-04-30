import { Module } from '@nestjs/common';
import { ExtractJwt } from '../../../src';
import { JwtAuthzModule1, JwtAuthzModule2 } from '../jwt.module';
import { SessionAuthzModule3, SessionAuthzModule4 } from '../session.module';
import { Jwt2UnderJwt1Controller } from './jwt-2-under-jwt-1.controller';
import { JwtRefreshController } from './jwt-refresh.controller';
import { JwtSessionAuthzController } from './jwt-session-authz.controller';
import { JwtSessionRefreshController } from './jwt-session-refresh.controller';
import { JwtUnderSessionController } from './jwt-under-session.controller';
import { Session4UnderSession3Controller } from './session-4-under-session-3.controller';
import { SessionUnderJwtController } from './session-under-jwt.controller';

@Module({
  imports: [
    JwtAuthzModule1.register({
      jwt: {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secret: '7890123456',
        algorithm: 'HS256',
        expiresIn: '1m'
      },
      refresh: {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secret: '65433210987',
        algorithm: 'HS512'
      },
      routes: [Jwt2UnderJwt1Controller, JwtUnderSessionController, SessionUnderJwtController, JwtRefreshController]
    }),
    JwtAuthzModule2.register({
      jwt: {
        jwtFromRequest: [ExtractJwt.fromUrlQueryParameter('token'), ExtractJwt.fromAuthHeaderAsBearerToken()],
        secret: '8901234567',
        algorithm: 'HS256'
      },
      routes: [Jwt2UnderJwt1Controller, JwtSessionRefreshController, JwtSessionAuthzController]
    }),
    SessionAuthzModule3.register({
      routes: [
        Session4UnderSession3Controller,
        SessionUnderJwtController,
        JwtUnderSessionController,
        JwtSessionRefreshController
      ]
    }),
    SessionAuthzModule4.register({
      routes: [Session4UnderSession3Controller, JwtSessionAuthzController]
    })
  ],
  controllers: [
    Jwt2UnderJwt1Controller,
    JwtUnderSessionController,
    Session4UnderSession3Controller,
    SessionUnderJwtController,
    JwtRefreshController,
    JwtSessionRefreshController,
    JwtSessionAuthzController
  ]
})
export class MixModule {}
