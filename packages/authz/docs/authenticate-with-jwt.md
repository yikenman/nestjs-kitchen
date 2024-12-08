# Authenticate with JWT

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
import { createJwtAuthzModule } from '@nestjs-kitchen/authz';
import { AuthzProvider } from './authz.provider.ts';

export const {
  AuthzGuard,
  AuthzService,
  AuthzModule
} = createJwtAuthzModule(AuthzProvider);

// Fix typescript type hint error
export type AuthzService = InstanceType<typeof AuthzService>;
```

## 3. Use AuthzGuard in your business controller:

```typescript
// business.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthzGuard, AuthzService } from './authz.module';

@UseGuards(AuthzGuard)
@Controller('apply-on-both')
export class BusinessController {
  constructor(private readonly authzService: AuthzService) {}
  
  // Escape from AuthzGuard
  @AuthzGuard.NoVerify()
  @Get('log-in')
  async logIn() {
    // get user from db or other api.
    const user = // ...
    // call AuthzService.login to create JWT.
    const result = await this.authzService.logIn(user);
    return result;
  }
  
  @Get('get-user')
  async getUser() {
    // AuthzService.getUser can get current request user across services. 
    const user = await this.authzService.getUser();
    return user;
  }
}
```

## 4. Import AuthzModule

```typescript
// business.module.ts
import { Module } from '@nestjs/common';
import { ExtractJwt } from '@nestjs-kitchen/authz';
import { AuthzModule } from './authz.module';
import { BusinessController } from './business.controller';

@Module({
  imports: [
    // Import and configure JWT strategy
    AuthzModule.register({
      jwt: {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secret: '1234567890',
        algorithm: 'HS256'
      },
      // Apply strategy to specific controllers. 
      routes: [BusinessController]
    })
  ],
  controllers: [BusinessController]
})
export class BusinessModule {}
```
