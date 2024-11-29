import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';
import { ApplyJwtModule } from './apply-jwt/apply-jwt.module';
import { ApplySessionModule } from './apply-session/apply-session.module';
import { DuplicatedJwtModule } from './duplicated-jwt/duplicated-jwt.module';
import { DuplicatedSessionModule } from './duplicated-session/duplicated-session.module';
import { MixModule } from './mix/mix.module';

@Module({
  imports: [
    ApplyJwtModule,
    ApplySessionModule,
    DuplicatedJwtModule,
    DuplicatedSessionModule,
    MixModule,
    RouterModule.register([
      {
        path: 'apply-jwt',
        module: ApplyJwtModule
      },
      {
        path: 'apply-session',
        module: ApplySessionModule
      },
      {
        path: 'duplicated-jwt',
        module: DuplicatedJwtModule
      },
      {
        path: 'duplicated-session',
        module: DuplicatedSessionModule
      },
      {
        path: 'mix',
        module: MixModule
      }
    ])
  ],
  controllers: [],
  providers: []
})
export class AppModule {}
