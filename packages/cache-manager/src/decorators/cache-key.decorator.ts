import { type ExecutionContext, SetMetadata } from '@nestjs/common';
import { isNil } from '@nestjs/common/utils/shared.utils';
import { CACHE_KEY_METADATA } from '../cache.constants';

type CacheKeyExecutionContextFactory = (ctx: ExecutionContext) => Promise<string> | string;
type CacheKeyArgumentFactory = (args: any[]) => Promise<string> | string;

/**
 * Decorator that sets the caching key used to store/retrieve cached items.
 *
 * Supports both static string keys and dynamic keys via a callback function.
 *
 * - When applied to HTTP, WebSocket, Microservice, or GraphQL methods, the callback receives an `ExecutionContext` as an argument.
 * - When applied to regular methods, the callback receives the corresponding method parameters.
 * - When applied to a class, only a callback function is allowed.
 *
 * @example
 * ```typescript
 * ⁣@CacheKey('events') // Static key
 * async fetchData() { ... }
 *
 * ⁣@CacheKey((context: ExecutionContext) => context.switchToHttp().getRequest().url)
 * async fetchDataWithDynamicKey() { ... }
 *
 * ⁣@CacheKey((args: any[]) => args[0]) // First argument as key
 * async getItemById(id: string) { ... }
 * ```
 *
 * @param key A static string or a callback function that dynamically generates the cache key.
 *
 * @see [Caching](https://docs.nestjs.com/techniques/caching)
 *
 *
 * @publicApi
 */
export function CacheKey(key: string): MethodDecorator;
export function CacheKey(key: CacheKeyExecutionContextFactory): MethodDecorator & ClassDecorator;
export function CacheKey(key: CacheKeyArgumentFactory): MethodDecorator & ClassDecorator;
export function CacheKey(key: string | CacheKeyExecutionContextFactory | CacheKeyArgumentFactory) {
  if (isNil(key)) {
    throw new Error('CacheKey requires a valid key but received an empty or undefined value.');
  }
  return (target: any, propertyKey: any, propertyDescriptor: any) => {
    // class decorator cannot use string key
    if (propertyKey === undefined && propertyDescriptor === undefined && typeof key === 'string') {
      throw new Error('CacheKey cannot use a string key at the class level. Use a function instead.');
    }
    return SetMetadata(CACHE_KEY_METADATA, key)(target, propertyKey, propertyDescriptor);
  };
}
