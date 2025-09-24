# @nestjs-kitchen/proxy

[![NPM Version](https://img.shields.io/npm/v/%40nestjs-kitchen%2Fproxy)
](https://www.npmjs.com/package/@nestjs-kitchen/proxy)
![NPM License](https://img.shields.io/npm/l/%40nestjs-kitchen%2Fproxy)
[![codecov](https://codecov.io/gh/yikenman/nestjs-kitchen/graph/badge.svg?token=43EG2T8LKS&flag=@nestjs-kitchen/proxy)](https://codecov.io/gh/yikenman/nestjs-kitchen)

Provides an HTTP proxy functionality in the NestJS style.

---

## Feature

- ✅ Provides a NestJS-style API.

- ✅ Built on top of [`http-proxy-middleware`](https://www.npmjs.com/package/http-proxy-middleware)

- ✅ Compatible with both `@nestjs/platform-express` and `@nestjs/platform-fastify`.

## Install

```bash
$ npm install --save @nestjs-kitchen/proxy
```

## Usage

### Example

Register module:

```ts
// in app.module.ts
@Module({
  imports: [
    // ...
    ProxyModule.register({
      options: {
        target: 'https://you.com/target/api',
        changeOrigin: true,
        agent: new Agent({ keepAlive: true })
      }
    })
    // ...
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
```

Apply Proxy in a Controller:

```ts
// in app.controller.ts
import { Controller, All, Post } from '@nestjs/common';
import { ProxyInterceptor } from '@nestjs-kitchen/proxy';

@UseInterceptors(ProxyInterceptor)
@Controller()
export class AppController {

  @ProxyInterceptor.Use({
    headers: { 'x-handler': 'ok' },
    pathRewrite: { '^/proxy-api': '' }
  })
  @All('/proxy-api/*')
  proxyApi() {
    return true;
  }
}
```

### Options

See [`http-proxy-middleware#options`](https://www.npmjs.com/package/http-proxy-middleware#options).

## License

MIT License