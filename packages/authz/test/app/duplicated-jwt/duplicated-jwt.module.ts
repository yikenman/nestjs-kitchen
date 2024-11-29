import { Module } from '@nestjs/common';
import { ExtractJwt } from '../../../src';
import { ApplyOnBothController } from '../apply-jwt/apply-on-both.controller';
import { JwtAuthzModule1 } from '../jwt.module';

@Module({
  imports: [
    JwtAuthzModule1.register({
      jwt: {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secret: '3456789012',
        algorithm: 'HS384'
      },
      routes: ['/duplicated-jwt/apply-on-both']
    }),
    JwtAuthzModule1.register({
      jwt: {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secret: '4567890123',
        algorithm: 'HS512'
      },
      routes: ['/duplicated-jwt/apply-on-both']
    })
  ],
  controllers: [ApplyOnBothController]
})
export class DuplicatedJwtModule {}
