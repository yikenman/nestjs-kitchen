# @nestjs-kitchen/authz

Simplest authentication & authorization module in NextJS.

---


## Description

**@nestjs-kitchen/authz** is an easy-to-use TypeScript library to apply JWT/Session authentication and authorization to your NestJS application within **4** steps.

## Features

- JWT based authentication
- Session based authentication
- Customizable authorization
- Simplified setups and APIs 
- Anonymous access support
- Simultaneous multiple strategy (JWT/Session) uses

## Install

Once completed NestJS project setup, install this package and its dependencies: 

```bash
$ npm install --save @nestjs/passport passport @nestjs-kitchen/authz
```

## Usage

1. Create file `authz.provider.ts`:

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

2. Create file `authz.module.ts`:

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

3. Use AuthzGuard in your business controller:

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

4. Import AuthzModule

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

## Errors

The following errors may be thrown during authentication and authorization:

- AuthzError: The base error type.
- AuthzVerificationError: Thrown when authentication fails.
- AuthzAnonymousError: Thrown when authentication returns empty.

### Error handling

See [Catch everything](https://docs.nestjs.com/exception-filters#catch-everything) for handling custom error types.

## Examples

Find more scenarios:

- [Authenticate with JWT](./docs/authenticate-with-jwt.md)
- [Authenticate & authorize with JWT](./docs/authenticate-&-authorize-with-jwt.md)
- [Authenticate with Session](./docs/authenticate-with-session.md)
- [Authenticate & authorize with Session](./docs/authenticate-&-authorize-with-session.md)
- [Use JWT with refresh token](./docs/use-jwt-with-refresh-token.md)
- [Use JWT and refresh token via session](./docs/use-jwt-and-refresh-token-via-session.md)

## License

MIT License