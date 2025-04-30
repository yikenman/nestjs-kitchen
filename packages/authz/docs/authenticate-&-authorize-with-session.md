# Authenticate & authorize with Session

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
  
  authorize(uesr: User, metaData?: string) {
    // Determine a user is authorized or not using metaData & user entity
    if(metaData === 'REQUIRED_ROLE'){
        return // ...
    }
    return // ...
  }
}
```

## 2. Create file `authz.module.ts`:

```typescript
// authz.module.ts
import { cereateSessionAuthzModule } from '@nestjs-kitchen/authz';
import { AuthzProvider } from './authz.provider.ts';

// Use Session strategy
export const {
  AuthzGuard,
  AuthzService,
  AuthzModule
} = cereateSessionAuthzModule(AuthzProvider);

// Fix typescript type hint error
export type AuthzService = InstanceType<typeof AuthzService>;
```

## 3. Use AuthzGuard in your business controller:

```typescript
// business.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthzGuard, AuthzService } from './authz.module';

@UseGuards(AuthzGuard)
// AuthzProvider.authorize will authorize user with meta data: 'REQUIRED_ROLE'
@AuthzGuard.Verify('REQUIRED_ROLE')
@Controller('apply-on-both')
export class BusinessController {
  constructor(private readonly authzService: AuthzService) {}
  
  // Escape from AuthzGuard
  @AuthzGuard.NoVerify()
  @Get('log-in')
  async logIn() {
    // get user from db or other api.
    const user = // ...
    // call AuthzService.login to create Session Id. 
    await this.authzService.logIn(user);
    return;
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
    // Import and configure session strategy
    AuthzModule.register({
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
