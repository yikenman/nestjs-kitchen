import { Module } from '@nestjs/common';
import { ExtractJwt } from '../../../src';
import { JwtAuthzModule1 } from '../jwt.module';
import { ApplyOnBothController } from './apply-on-both.controller';
import { ApplyOnClassController } from './apply-on-class.controller';
import { ApplyOnMethodController } from './apply-on-method.controller';

@Module({
  imports: [
    JwtAuthzModule1.register({
      jwt: {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secret: '1234567890',
        algorithm: 'HS256'
      },
      routes: [ApplyOnBothController, ApplyOnClassController, ApplyOnMethodController]
    })
  ],
  controllers: [ApplyOnBothController, ApplyOnClassController, ApplyOnMethodController]
})
export class ApplyJwtModule {}
