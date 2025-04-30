import { Module } from '@nestjs/common';
import { ApplyOnBothController } from '../apply-session/apply-on-both.controller';
import { SessionAuthzModule3 } from '../session.module';

@Module({
  imports: [
    SessionAuthzModule3.register({
      routes: ['/duplicated-session/apply-on-both']
    }),
    SessionAuthzModule3.register({
      routes: ['/duplicated-session/apply-on-both']
    })
  ],
  controllers: [ApplyOnBothController]
})
export class DuplicatedSessionModule {}
