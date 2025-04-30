# Use JWT and refresh token via session

**NOTE: ensure you have setup [`express-session`](https://www.npmjs.com/package/express-session).**

```typescript
import * as session from 'express-session';
// somewhere in your initialization file
app.use(
  session({
    secret: 'my-secret',
    resave: false,
    saveUninitialized: false,
  }),
);
```

## 1. Create file `authz.provider.ts`:

```typescript
// authz.provider.ts
import { Injectable } from '@nestjs/common';
import { AuthzProviderClass } from '@nestjs-kitchen/authz';

// The type representing the payload used for authentication.
interface Payload {
// ...
}

// The type representing the user entity involved in authentication and authorization.
export interface User {
// ...
}

@Injectable()
export class AuthzProvider extends AuthzProviderClass<Payload, User> {
  authenticate(payload: Payload) {
    // Return payload.
  };

  createPayload(user: User) {
    // Return user entity.
  };
}
```

## 2. Create file `authz.module.ts`:

```typescript
// authz.module.ts
import { createJwtAuthzModule, cereateSessionAuthzModule } from '@nestjs-kitchen/authz';
import { AuthzProvider } from './authz.provider.ts';

export const {
  AuthzGuard: JwtAuthzGuard,
  AuthzService: JwtAuthzService,
  AuthzModule: JwtAuthzModule
} = createJwtAuthzModule(AuthzProvider);

export const {
  AuthzGuard: SessionAuthzGuard,
  AuthzService: SessionAuthzService,
  AuthzModule: SessionAuthzModule
} = cereateSessionAuthzModule(AuthzProvider);

// Fix typescript type hint error
export type JwtAuthzService = InstanceType<typeof JwtAuthzService>;
export type SessionAuthzService = InstanceType<typeof SessionAuthzService>;
```

## 3. Use AuthzGuard in your business controller:

```typescript
// business.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthzGuard, JwtAuthzService, SessionAuthzGuard, SessionAuthzService } from './authz.module';

@UseGuards(JwtAuthzGuard)
@Controller('apply-on-both')
export class BusinessController {
  constructor(
    private readonly jwtAuthzService: JwtAuthzService,
    private readonly sessionAuthzService: SessionAuthzService,
  ) {}
  
  // Escape from AuthzGuard
  @JwtAuthzGuard.NoVerify()
  @Get('log-in')
  async logIn() {
    // get user from db or other api.
    const user = // ...
    // create JWT.
    const result = await this.jwtAuthzService.logIn(user);
    // create session id.
    await this.sessionAuthzService.logIn(user);
    return result;
  }
  
  @Get('get-user')
  async getUser() {
    const user = await this.jwtAuthzService.getUser();
    return user;
  }

  // Accepts only JWT corresponding refresh tokens.
  @JwtAuthzGuard.NoVerify()
  @UseGuard(SessionAuthzGuard)
  @Get('refresh')
  async getUser() {
    // get user from session
    const user = await this.sessionAuthzService.getUser();
    // A new JWT will be generated.
    const result = await this.jwtAuthzService.refresh(user);
    return result;
  }
}
```

## 4. Import AuthzModule

```typescript
// business.module.ts
import { Module } from '@nestjs/common';
import { ExtractJwt } from '@nestjs-kitchen/authz';
import { JwtAuthzModule, SessionAuthzModule } from './authz.module';
import { BusinessController } from './business.controller';

@Module({
  imports: [
    // Import and configure JWT strategy
    JwtAuthzModule.register({
      jwt: {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secret: '1234567890',
        algorithm: 'HS256'
      },
      routes: [BusinessController]
    })
    // Import and configure session strategy
    SessionAuthzModule.register({
      session: {
          name: 'custom-session-id-name',
          secret: '1234567890'
      },
      // Apply strategy to specific controllers.
      routes: [BusinessController]
    })
  ],
  controllers: [BusinessController]
})
export class BusinessModule {}
```
