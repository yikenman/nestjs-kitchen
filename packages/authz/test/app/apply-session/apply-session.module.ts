import { Module } from '@nestjs/common';
import { SessionAuthzModule3 } from '../session.module';
import { ApplyOnBothController } from './apply-on-both.controller';
import { ApplyOnClassController } from './apply-on-class.controller';
import { ApplyOnMethodController } from './apply-on-method.controller';

@Module({
  imports: [
    SessionAuthzModule3.register({
      session: {
        name: 'session-id-2345678901',
        secret: '2345678901'
      },
      routes: [ApplyOnBothController, ApplyOnClassController, ApplyOnMethodController]
    })
  ],
  controllers: [ApplyOnBothController, ApplyOnClassController, ApplyOnMethodController]
})
export class ApplySessionModule {}
