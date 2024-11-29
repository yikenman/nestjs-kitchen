import { Module } from '@nestjs/common';
import { ApplyOnBothController } from '../apply-session/apply-on-both.controller';
import { SessionAuthzModule3 } from '../session.module';

@Module({
  imports: [
    SessionAuthzModule3.register({
      session: {
        name: 'session-id-5678901234',
        secret: '5678901234'
      },
      routes: ['/duplicated-session/apply-on-both']
    }),
    SessionAuthzModule3.register({
      session: {
        name: 'session-id-6789012345',
        secret: '6789012345'
      },
      routes: ['/duplicated-session/apply-on-both']
    })
  ],
  controllers: [ApplyOnBothController]
})
export class DuplicatedSessionModule {}
