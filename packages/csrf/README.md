# @nestjs-kitchen/csrf

[![NPM Version](https://img.shields.io/npm/v/%40nestjs-kitchen%2Fcsrf)
](https://www.npmjs.com/package/@nestjs-kitchen/csrf)
![NPM License](https://img.shields.io/npm/l/%40nestjs-kitchen%2Fcsrf)
[![codecov](https://codecov.io/gh/yikenman/nestjs-kitchen/graph/badge.svg?token=43EG2T8LKS&flag=@nestjs-kitchen/csrf)](https://codecov.io/gh/yikenman/nestjs-kitchen)

A CSRF module in NextJS.

---

## Feature

- ✅ Supports `double-csrf` validation strategy (cookie-based, stateless)

- ✅ Supports traditional `session`-based validation strategy (stateful)

- ✅ Supports one-time-use CSRF tokens

- ✅ Compatible with both `@nestjs/platform-express` and `@nestjs/platform-fastify` frameworks

## Install

```bash
$ npm install --save @nestjs-kitchen/csrf
```

## Usage

### `double-csrf` Strategy (Cookie-Based)

This strategy stores the CSRF secret in the cookie and requires cookie support.

For `@nestjs/platform-express`:

```bash
npm install cookie-parser
```

For `@nestjs/platform-fastify`:

```bash
npm install @fastify/cookie
```

#### Example

Register module:

```ts
// in app.module.ts

@Module({
  imports: [
    // ...
    CsrfModule.register({
      type: 'double-csrf'
    })
    // ...
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
```

Apply CSRF in a Controller:

```ts
// in app.controller.ts

import { Controller, Get, Post } from '@nestjs/common';
import { Csrf, CsrfInterceptor, CsrfGuard } from '@nestjs-kitchen/csrf';

@UseGuards(CsrfGuard)
@UseInterceptors(CsrfInterceptor)
@Controller()
export class AppController {

  @Csrf()
  @Post('/require-csrf')
  post(){
    // This handler will only execute if CSRF validation passes
    // ...
  }

  @Csrf.Sign()
  @Get('/csrf')
  csrf() {
    // Generates and stores a new CSRF token (skips CSRF validation)
    return true;
  }
}
```

### `session` Strategy (Session-Based)

This strategy stores the CSRF secret in the session and requires session support.

For `@nestjs/platform-express`:

```bash
npm install express-session
```

For `@nestjs/platform-fastify`:

```bash
npm install @fastify/session
```

Alternatively, for `Fastify`, you can also use:

```bash
npm install @fastify/secure-session
```
> ⚠️ Note: When using `@fastify/secure-session`, one-time CSRF tokens are not supported because secure-session is stateless.

#### Example

Register module:

```ts
// in app.module.ts

import { Module } from "@nestjs/common";
import { CsrfModule } from '@nestjs-kitchen/csrf';
import { AppController } from './app.controller.ts';

@Module({
  imports: [
    // ...
    CsrfModule.register({
      type: 'session'
    })
    // ...
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
```

Apply CSRF in a Controller: 

[Same as `double-csrf` example](#example).

### Options

#### Common options:

| Option          | Type                   | Description                                                                 | Default                                                  |
| --------------- | ---------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------- |
| `getToken`      | `(req: any) => string` | Function to extract CSRF token from the request.                            | `(req) => req.headers['x-csrf-token']`                   |
| `headerKey`     | `string`               | Response header name to expose the CSRF token.                              | `'x-csrf-token'`                                         |
| `verifyMethods` | `HttpMethod[]`         | List of HTTP methods that require CSRF validation.                          | `['PATCH', 'PUT', 'POST', 'DELETE', 'CONNECT', 'TRACE']` |
| `global`        | `boolean`              | If set to `true`, automatically applies `CsrfGuard` and `CsrfInterceptor` globally. | `false`                                                   |


#### `double-csrf` options:

| Option                   | Type            | Description                                                          | Default         |
| ------------------------ | --------------- | -------------------------------------------------------------------- | --------------- |
| `type`                   | `'double-csrf'` | Strategy type: stores token in cookie only. Requires cookie support. | `'double-csrf'` |
| `cookieKey`              | `string`        | Cookie name to store CSRF secret.                                    | `'_csrf'`       |
| `cookieOptions.path`     | `string`        | Cookie path.                                                         | `'/'`           |
| `cookieOptions.secure`   | `boolean`       | Use secure cookie (only sent over HTTPS).                            | `false`         |
| `cookieOptions.sameSite` | `string`        | SameSite policy.                                                     | `'strict'`      |
| `cookieOptions.httpOnly` | `boolean`       | Whether the cookie is `HttpOnly`.                                    | `true`          |
| `cookieOptions.signed`   | `boolean`       | Whether the cookie is signed.                                        | `false`         |
| `cookieOptions.maxAge`   | `number`        | Cookie expiration.                                   | `undefined`     |
| `cookieOptions[...]`     | `any`           | Additional cookie options.                                           | —               |

#### `session` options:

| Option            | Type                                                                  | Description                                                       | Default     |
| ----------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------- |
| `type`            | `'session'`                                                           | Strategy type: stores token in session. Requires session support. | `'session'` |
| `sessionKey`      | `string`                                                              | Session key to store the CSRF secret.                             | `'_csrf'`   |
| `oneTimeToken`    | `boolean`                                                             | Enable one-time-use tokens (valid for a single use only).         | `false`     |
| `oneTimeTokenTTL` | `number`                                                              | TTL for one-time tokens in milliseconds.                          | `undefined` |
| `nonceStore.get`  | `(key: string) => any \| Promise<any>`                                | Retrieve one-time token from store.                               | In-memory   |
| `nonceStore.set`  | `(key: string, value: string, ttl?: number) => void \| Promise<void>` | Store one-time token.                                             | In-memory   |
| `nonceStore.del`  | `(key: string) => void \| Promise<void>`                              | Delete one-time token.                                            | In-memory   |



## License

MIT License