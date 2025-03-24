# @nestjs-kitchen/cache-manager

[![NPM Version](https://img.shields.io/npm/v/%40nestjs-kitchen%2Fcache-manager)
](https://www.npmjs.com/package/@nestjs-kitchen/cache-manager)
![NPM License](https://img.shields.io/npm/l/%40nestjs-kitchen%2Fcache-manager)
[![codecov](https://codecov.io/gh/yikenman/nestjs-kitchen/graph/badge.svg?token=43EG2T8LKS&flag=@nestjs-kitchen/cache-manager)](https://codecov.io/gh/yikenman/nestjs-kitchen)

A better caching module for NestJS, fully compatible with [@nestjs/cache-manager](https://www.npmjs.com/package/@nestjs/cache-manager) v3.

---

## Features

- ✅ Supports caching for regular methods.
- ✅ Dynamically set cache key and TTL.
- ✅ Fully compatible with @nestjs/cache-manager API.
- ✅ 100% test coverage.

## Install

```bash
$ npm install --save @nestjs-kitchen/cache-manager cache-manager
```

## Usage

### Apply `CacheModule`

```typescript
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs-kitchen/cache-manager';
import { AppController } from './app.controller';

@Module({
  imports: [CacheModule.register()],
  controllers: [AppController],
})
export class AppModule {}
```

### Auto-caching response

```typescript
@Controller()
@UseInterceptors(CacheInterceptor)
export class AppController {
  @Get()
  findAll(): string[] {
    return [];
  }
}
```

### Auto-caching method result

```typescript
@Injectable()
export class AppService {
  @CacheResult()
  @Get()
  findAll(): string[] {
    return [];
  }
}
```

### Dynamic cache key & TTL

- **For non-regular methods** (HTTP, WebSocket, Microservice, or GraphQL), the callback receives `ExecutionContext` as the argument.  

  ```typescript
  @Controller()
  @CacheKey((context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest();
    return `user:${request.params.id}`;
  })
  @CacheTTL((context: ExecutionContext) => {
    return context.switchToHttp().getRequest().query.cacheTime || 60;
  })
  @UseInterceptors(CacheInterceptor)
  export class AppController {
    @Get()
    findAll(): string[] {
      return [];
    }
  }
  ```

- **For regular methods**, the callback receives the method `arguments`.

  ```typescript
  @Injectable()
  export class AppService {
    @CacheKey((args: any[]) => `user:${args[0]}`)
    @CacheTTL((args: any[]) => 120)
    @CacheResult()
    @Get()
    findAll(): string[] {
      return [];
    }
  }
  ```

## APIs

### CacheModule

Same as `@nestjs/cache-manager` CacheModule.

### CacheInterceptor

Same as `@nestjs/cache-manager` CacheInterceptor.

### CacheResult

Decorator that applies a cache mechanism to regular method, enabling caching for method results.

- Only applicable to regular methods (non-HTTP/WebSocket/Microservice/GraphQL methods).
- Compatible with `@CacheKey` and `@CacheTTL` for cache control.
- Automatically disabled when applied to HTTP, WebSocket, Microservice, or GraphQL methods.

Example:

```typescript
class ExampleService {
  ⁣@CacheResult()
  async fetchData() { ... }

  ⁣@CacheResult()
  ⁣@CacheKey((args: any[]) => `data:${args[0]}`)
  @CacheTTL(60)
  async getItemById(id: number) { ... }
}
```

### CacheKey

Decorator that sets the caching key used to store/retrieve cached items.

Supports both static string keys and dynamic keys via a callback function.

- When applied to HTTP, WebSocket, Microservice, or GraphQL methods, the callback receives an `ExecutionContext` as an argument.
- When applied to regular methods, the callback receives the corresponding method parameters.
- When applied to a class, only a callback function is allowed.

Example:

```typescript
@CacheKey('events') // Static key
async fetchData() { ... }

@CacheKey((context: ExecutionContext) => context.switchToHttp().getRequest().url)
async fetchDataWithDynamicKey() { ... }

@CacheKey((args: any[]) => args[0]) // First argument as key
async getItemById(id: string) { ... }
```

### CacheTTL

Decorator that sets the cache TTL (time-to-live) duration for cache expiration.

Supports both static numeric values and dynamic TTL values via a callback function.

- When applied to HTTP, WebSocket, Microservice, or GraphQL methods, the callback receives an `ExecutionContext` as an argument.
- When applied to regular methods, the callback receives the corresponding method parameters.

Eexample:

```typescript
@CacheTTL(5) // Static TTL of 5 seconds
async fetchData() { ... }

@CacheTTL((context: ExecutionContext) => context.getHandler().name === 'fastQuery' ? 2 : 10)
async fetchDataWithDynamicTTL() { ... }

⁣@CacheTTL((args: any[]) => args[0] > 10 ? 30 : 60) // TTL based on first argument
async getItemById(id: number) { ... }
```

## Reference

For more usage, please see [Caching](https://docs.nestjs.com/techniques/caching).

## License

MIT License